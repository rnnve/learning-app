import { type AppTheme, useAppTheme as useTheme } from "@/theme/useAppTheme";
import React from "react";
import { StyleSheet, Text, type TextStyle } from "react-native";

interface MarkdownLiteTextProps {
  content: string;
  style?: TextStyle;
  selectable?: boolean;
}

interface Segment {
  text: string;
  bold: boolean;
  key: string;
}

interface ParsedLine {
  key: string;
  isBullet: boolean;
  segments: Segment[];
}

/**
 * Split a line into bold/plain segments. Every segment gets a stable key that
 * is derived from its text (plus the number of times the same text appears on
 * the line), so re-rendering never mixes up segment state.
 */
function parseSegments(text: string): Segment[] {
  const raw = text.split(/(\*\*[^*]+\*\*)/g);
  const occurrences = new Map<string, number>();

  return raw
    .filter((part) => part.length > 0)
    .map((part) => {
      const bold = part.startsWith("**") && part.endsWith("**");
      const content = bold ? part.slice(2, -2) : part;
      const occurrence = (occurrences.get(content) ?? 0) + 1;
      occurrences.set(content, occurrence);
      return {
        text: content,
        bold,
        key: `${bold ? "b" : "t"}-${content}-${occurrence}`,
      };
    });
}

/**
 * Minimal markdown: "- " / "* " bullets and **bold** only. No HTML, no LaTeX.
 */
function parseContent(content: string): ParsedLine[] {
  return content.split("\n").map((line, lineNumber) => {
    const isBullet = line.startsWith("- ") || line.startsWith("* ");
    const textToParse = isBullet ? line.substring(2) : line;
    return {
      key: `line-${lineNumber}`,
      isBullet,
      segments: parseSegments(textToParse),
    };
  });
}

export function MarkdownLiteText({ content, style, selectable = true }: MarkdownLiteTextProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const lines = parseContent(content);

  return (
    <>
      {lines.map((line) => (
        <Text
          key={line.key}
          selectable={selectable}
          style={[
            { color: theme.colors.onSurface },
            [styles.line, { color: theme.colors.onSurface }, style],
          ]}
        >
          {line.isBullet ? "• " : ""}
          {line.segments.map((segment) =>
            segment.bold ? (
              <Text key={segment.key} style={styles.bold}>
                {segment.text}
              </Text>
            ) : (
              <Text key={segment.key}>{segment.text}</Text>
            ),
          )}
        </Text>
      ))}
    </>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    line: {
      fontSize: 15,
      lineHeight: 24, // >= 1.5x font size for Thai vowels & tone marks
      marginBottom: 4,
    },
    bold: {
      fontWeight: "700",
    },
  });
