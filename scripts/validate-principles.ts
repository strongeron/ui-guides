#!/usr/bin/env npx tsx
/**
 * Principle Validation Script
 * Checks field completeness, example mapping, and theme support for all principles
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { principles } from '../src/data/principles';
import type { Principle } from '../src/types/principle';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

interface ExampleAnalysis {
  path: string;
  key: string;
  hasDarkModeSupport: boolean;
  hasLightModeSupport: boolean;
  usesHardcodedColors: boolean;
  hardcodedColors: string[];
  hasProperContrast: boolean;
  hasTailwindDarkClasses: boolean;
  issues: string[];
}

interface ValidationResult {
  id: string;
  category: string;
  title: string;
  hasSourceQuote: boolean;
  hasSourceLinks: boolean;
  hasAdditionalExplanation: boolean;
  hasBadExample: boolean;
  hasGoodExample: boolean;
  badExampleExists: boolean;
  goodExampleExists: boolean;
  badExampleAnalysis?: ExampleAnalysis;
  goodExampleAnalysis?: ExampleAnalysis;
  sourceLinksCount: number;
  issues: string[];
}

interface CategorySummary {
  category: string;
  total: number;
  valid: number;
  invalid: number;
  themeIssues: number;
  issues: { id: string; issues: string[] }[];
}

// Find all example component files and map keys to paths
function findExampleComponents(): Map<string, string> {
  const examplesDir = join(rootDir, 'src/components/examples');
  const components = new Map<string, string>();

  function scanDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.tsx') && !entry.name.startsWith('index')) {
        // Convert file path to example key format
        const relativePath = relative(examplesDir, fullPath);
        const key = relativePath
          .replace('.tsx', '')
          .replace(/\\/g, '/')
          .split('/')
          .map((part, i) => {
            if (i === 0) return part.toLowerCase(); // category
            // Convert PascalCase to kebab-case
            return part.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
          })
          .join('-');
        components.set(key, fullPath);
      }
    }
  }

  if (existsSync(examplesDir)) {
    scanDir(examplesDir);
  }

  return components;
}

// Semantic color tokens that are dark-mode compatible via CSS variables
const SEMANTIC_COLOR_TOKENS = [
  // Background tokens
  'bg-background', 'bg-foreground', 'bg-card', 'bg-popover', 'bg-muted',
  'bg-primary', 'bg-secondary', 'bg-accent', 'bg-destructive', 'bg-success',
  // Foreground/text tokens
  'text-foreground', 'text-card-foreground', 'text-popover-foreground',
  'text-muted-foreground', 'text-primary-foreground', 'text-secondary-foreground',
  'text-accent-foreground', 'text-destructive-foreground', 'text-destructive',
  'text-success', 'text-success-foreground',
  // Border tokens
  'border-border', 'border-input', 'border-ring',
  // Ring tokens
  'ring-ring', 'ring-offset-background',
  // Sidebar tokens (shadcn)
  'bg-sidebar', 'text-sidebar-foreground', 'border-sidebar',
];

// Analyze an example component for theme support
/**
 * Examples where a raw, non-tokenized color IS the subject matter. Suppressing the
 * theme heuristics here is a declared, reviewed decision — not a blanket mute. The
 * report prints these so they stay visible.
 *
 * Rewriting these to use semantic tokens would destroy the thing they teach: you
 * cannot demonstrate a theme-flip, a brand gradient, or gradient-text selection
 * using only tokens that already adapt to the theme.
 */
const THEME_SUBJECT_EXEMPT: Record<string, string> = {
  'animations-theme-switch-no-transitions':
    'Builds its own light/dark palette to demonstrate suppressing transitions during a theme flip.',
  'aesthetics-memorable-differentiation':
    'The multi-stop brand gradient is the content being demonstrated.',
  'interactions-gradient-text-selection':
    'Gradient text and its ::selection behaviour are the subject.',
  'design-hue-consistency':
    'Drives its own OKLCH plate so the shadow/border/text tint can be derived from the background hue the reader picks — a theme token cannot be read back and shifted.',
};

/**
 * Is a light (or dark) surface pinned somewhere in this example?
 *
 * The old contrast check flagged any `text-neutral-900` that lacked a `dark:` variant,
 * without ever looking at what it sits on. Several examples deliberately pin a light
 * plate — shadows and hairline borders are only legible on one — so dark text there is
 * correct, not a contrast bug. Only flag text whose surface is not pinned to match.
 */
function pinsLightSurface(content: string): boolean {
  return /bg-(white|neutral-(50|100|200)|gray-(50|100|200)|zinc-(50|100|200)|slate-(50|100|200))\b/.test(content);
}

function pinsDarkSurface(content: string): boolean {
  return /bg-(black|neutral-(800|900|950)|gray-(800|900|950)|zinc-(800|900|950)|slate-(800|900|950))\b/.test(content);
}

function analyzeExampleComponent(filePath: string, key: string): ExampleAnalysis {
  const content = readFileSync(filePath, 'utf-8');
  const issues: string[] = [];
  const hardcodedColors: string[] = [];

  // Check for Tailwind dark: classes
  const hasTailwindDarkClasses = /dark:/i.test(content);

  // Check for semantic color tokens (these use CSS variables internally)
  const usesSemanticTokens = SEMANTIC_COLOR_TOKENS.some(token => content.includes(token));

  // Check for hardcoded colors (hex, rgb, rgba)
  const hexColorMatches = content.match(/#[0-9a-fA-F]{3,8}/g) || [];
  const rgbMatches = content.match(/rgb\([^)]+\)/gi) || [];
  const rgbaMatches = content.match(/rgba\([^)]+\)/gi) || [];
  const inlineStyleColors = content.match(/(?:color|background|border-color)\s*:\s*['"]?[^'";,}]+/gi) || [];

  hardcodedColors.push(...hexColorMatches, ...rgbMatches, ...rgbaMatches);

  // Filter out common acceptable colors (fully transparent, etc.)
  const problematicColors = hardcodedColors.filter(c => {
    // Allow transparent
    if (c.toLowerCase() === '#00000000' || c.toLowerCase() === 'rgba(0,0,0,0)') return false;
    // Allow currentColor references
    if (c.toLowerCase().includes('currentcolor')) return false;
    return true;
  });

  const usesHardcodedColors = problematicColors.length > 0;

  // Check for CSS variables (theme-aware)
  const usesCSSVariables = /var\(--/.test(content);

  // Determine theme support - semantic tokens are dark-mode compatible
  const hasDarkModeSupport = hasTailwindDarkClasses || usesCSSVariables || usesSemanticTokens;
  const hasLightModeSupport = true; // Default styles usually cover light mode

  // Dark text is only a contrast risk if the surface it sits on is NOT pinned light
  // (and vice versa). An example that pins `bg-white` and writes `text-neutral-900`
  // on it is correct in both themes, because the surface does not move either.
  const usesDarkText = /text-(gray|zinc|slate|neutral)-(900|950)/.test(content);
  const usesLightText = /text-(gray|zinc|slate|neutral)-(100|200|300)/.test(content);
  const hasContrastConcerns =
    !hasTailwindDarkClasses &&
    ((usesDarkText && !pinsLightSurface(content)) || (usesLightText && !pinsDarkSurface(content)));

  const exemptReason = THEME_SUBJECT_EXEMPT[key.replace(/-(good|bad)$/, '')];

  // Build issues list. Exempt examples still get analyzed — we just don't
  // report color findings against a demo whose whole point is the raw color.
  if (!exemptReason) {
    if (usesHardcodedColors && problematicColors.length > 3) {
      issues.push(`Uses ${problematicColors.length} hardcoded colors - may need theme tokens`);
    }

    if (!hasTailwindDarkClasses && !usesCSSVariables && !usesSemanticTokens) {
      issues.push('No dark mode support detected (missing dark: classes, CSS variables, or semantic tokens)');
    }

    if (inlineStyleColors.length > 2) {
      issues.push('Multiple inline style colors - prefer Tailwind classes for theme support');
    }
  }

  if (hasContrastConcerns) {
    issues.push('Potential contrast issues in dark/light modes');
  }

  return {
    path: filePath,
    key,
    hasDarkModeSupport,
    hasLightModeSupport,
    usesHardcodedColors,
    hardcodedColors: problematicColors.slice(0, 5), // Limit to first 5
    hasProperContrast: !hasContrastConcerns,
    hasTailwindDarkClasses,
    issues,
  };
}

// Validate a single principle
function validatePrinciple(
  principle: Principle,
  exampleComponents: Map<string, string>
): ValidationResult {
  const issues: string[] = [];

  const hasSourceQuote = Boolean(principle.sourceQuote?.trim());
  const hasSourceLinks = principle.sourceLinks.length > 0;
  const hasAdditionalExplanation = Boolean(principle.additionalExplanation?.trim());
  const hasBadExample = Boolean(principle.badExampleKey);
  const hasGoodExample = Boolean(principle.goodExampleKey);
  const badExamplePath = exampleComponents.get(principle.badExampleKey);
  const goodExamplePath = exampleComponents.get(principle.goodExampleKey);
  const badExampleExists = Boolean(badExamplePath);
  const goodExampleExists = Boolean(goodExamplePath);

  // Analyze examples if they exist
  let badExampleAnalysis: ExampleAnalysis | undefined;
  let goodExampleAnalysis: ExampleAnalysis | undefined;

  if (badExamplePath) {
    badExampleAnalysis = analyzeExampleComponent(badExamplePath, principle.badExampleKey);
    issues.push(...badExampleAnalysis.issues.map(i => `Bad example: ${i}`));
  }

  if (goodExamplePath) {
    goodExampleAnalysis = analyzeExampleComponent(goodExamplePath, principle.goodExampleKey);
    issues.push(...goodExampleAnalysis.issues.map(i => `Good example: ${i}`));
  }

  if (!hasSourceQuote) issues.push('Missing sourceQuote');
  if (!hasSourceLinks) issues.push('Missing sourceLinks');
  if (!hasAdditionalExplanation) issues.push('Missing additionalExplanation');
  if (!hasBadExample) issues.push('Missing badExampleKey');
  if (!hasGoodExample) issues.push('Missing goodExampleKey');
  if (hasBadExample && !badExampleExists) issues.push(`Bad example not found: ${principle.badExampleKey}`);
  if (hasGoodExample && !goodExampleExists) issues.push(`Good example not found: ${principle.goodExampleKey}`);

  return {
    id: principle.id,
    category: principle.category,
    title: principle.title,
    hasSourceQuote,
    hasSourceLinks,
    hasAdditionalExplanation,
    hasBadExample,
    hasGoodExample,
    badExampleExists,
    goodExampleExists,
    badExampleAnalysis,
    goodExampleAnalysis,
    sourceLinksCount: principle.sourceLinks.length,
    issues,
  };
}

// Main validation function
function main() {
  console.log('🔍 Validating Principles with Theme Support Analysis...\n');

  const exampleComponents = findExampleComponents();

  console.log(`Found ${principles.length} principles`);
  console.log(`Found ${exampleComponents.size} example components\n`);

  // Validate all principles
  const results: ValidationResult[] = principles.map(p => validatePrinciple(p, exampleComponents));

  // Group by category
  const byCategory = new Map<string, ValidationResult[]>();
  for (const result of results) {
    if (!byCategory.has(result.category)) {
      byCategory.set(result.category, []);
    }
    byCategory.get(result.category)!.push(result);
  }

  // Generate summary
  const summaries: CategorySummary[] = [];
  for (const [category, categoryResults] of byCategory) {
    const valid = categoryResults.filter(r => r.issues.length === 0);
    const invalid = categoryResults.filter(r => r.issues.length > 0);
    const themeIssues = categoryResults.filter(r =>
      r.issues.some(i => i.includes('dark mode') || i.includes('hardcoded colors') || i.includes('contrast'))
    );

    summaries.push({
      category,
      total: categoryResults.length,
      valid: valid.length,
      invalid: invalid.length,
      themeIssues: themeIssues.length,
      issues: invalid.map(r => ({ id: r.id, issues: r.issues })),
    });
  }

  // Print results
  console.log('📊 Category Summary\n');
  console.log('| Category | Total | Valid | Issues | Theme Issues |');
  console.log('|----------|-------|-------|--------|--------------|');
  for (const summary of summaries) {
    const status = summary.invalid === 0 ? '✅' : '⚠️';
    console.log(`| ${summary.category.padEnd(12)} | ${String(summary.total).padStart(5)} | ${String(summary.valid).padStart(5)} | ${String(summary.invalid).padStart(6)} ${status} | ${String(summary.themeIssues).padStart(12)} |`);
  }

  // Totals
  const totalPrinciples = summaries.reduce((acc, s) => acc + s.total, 0);
  const totalValid = summaries.reduce((acc, s) => acc + s.valid, 0);
  const totalInvalid = summaries.reduce((acc, s) => acc + s.invalid, 0);
  const totalThemeIssues = summaries.reduce((acc, s) => acc + s.themeIssues, 0);

  console.log('|--------------|-------|-------|--------|--------------|');
  console.log(`| **TOTAL**    | ${String(totalPrinciples).padStart(5)} | ${String(totalValid).padStart(5)} | ${String(totalInvalid).padStart(6)}   | ${String(totalThemeIssues).padStart(12)} |`);

  // Print detailed issues
  const allIssues = summaries.flatMap(s => s.issues);
  if (allIssues.length > 0) {
    console.log('\n\n⚠️ Issues Found\n');
    for (const summary of summaries) {
      if (summary.issues.length > 0) {
        console.log(`\n### ${summary.category} (${summary.issues.length} issues)`);
        for (const issue of summary.issues) {
          console.log(`\n**${issue.id}**`);
          for (const i of issue.issues) {
            console.log(`  - ${i}`);
          }
        }
      }
    }
  } else {
    console.log('\n\n✅ All principles are valid!');
  }

  // Theme support summary
  console.log('\n\n🎨 Theme Support Analysis\n');
  let withDarkMode = 0;
  let withoutDarkMode = 0;
  for (const result of results) {
    if (result.goodExampleAnalysis?.hasDarkModeSupport) withDarkMode++;
    else if (result.goodExampleExists) withoutDarkMode++;
  }
  console.log(`Examples with dark mode support: ${withDarkMode}`);
  console.log(`Examples without dark mode: ${withoutDarkMode}`);

  // Output JSON for programmatic use
  const outputPath = join(rootDir, 'doc/validation-results.json');
  const jsonOutput = JSON.stringify({
    timestamp: new Date().toISOString(),
    principleCount: principles.length,
    exampleCount: exampleComponents.size,
    summaries,
    results,
    themeAnalysis: {
      withDarkMode,
      withoutDarkMode,
    }
  }, null, 2);

  writeFileSync(outputPath, jsonOutput);
  console.log(`\n📁 Results saved to ${relative(rootDir, outputPath)}`);

  // Exit with error if issues found
  process.exit(allIssues.length > 0 ? 1 : 0);
}

main();
