export interface RawPageText {
  page: number | null;
  text: string;
}

export interface Chunk {
  idx: number;
  page: number | null;
  text: string;
  charCount: number;
}

export function chunkPages(pages: RawPageText[], targetChars = 3500, overlapChars = 300): Chunk[] {
  const chunks: Chunk[] = [];
  let currentText = "";
  let currentStartPage: number | null = null;
  let chunkIdx = 0;

  const segmenterWord = new Intl.Segmenter("th", { granularity: "word" });
  const segmenterSentence = new Intl.Segmenter("th", { granularity: "sentence" });

  for (const pageItem of pages) {
    const pageText = pageItem.text.trim();
    if (!pageText) continue;

    if (currentStartPage === null) {
      currentStartPage = pageItem.page;
    }

    // Split page text into natural paragraphs
    const paragraphs = pageText.split(/\n\s*\n+/);

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      if (currentText.length + trimmedPara.length + 2 <= targetChars) {
        currentText = currentText ? `${currentText}\n\n${trimmedPara}` : trimmedPara;
      } else {
        // Need to split or push current chunk
        if (currentText.length >= targetChars - overlapChars) {
          // Finalize current chunk
          chunks.push({
            idx: chunkIdx++,
            page: currentStartPage,
            text: currentText,
            charCount: currentText.length,
          });

          // Compute overlap
          const overlapSlice = getSafeOverlap(currentText, overlapChars, segmenterWord);
          currentText = overlapSlice ? `${overlapSlice}\n\n${trimmedPara}` : trimmedPara;
          currentStartPage = pageItem.page;
        } else {
          // Current paragraph itself is too large, split sentences
          const sentences = Array.from(segmenterSentence.segment(trimmedPara)).map(
            (s) => s.segment,
          );
          for (const sentence of sentences) {
            if (currentText.length + sentence.length <= targetChars) {
              currentText += sentence;
            } else {
              if (currentText.length > 0) {
                chunks.push({
                  idx: chunkIdx++,
                  page: currentStartPage,
                  text: currentText.trim(),
                  charCount: currentText.trim().length,
                });
                const overlapSlice = getSafeOverlap(currentText, overlapChars, segmenterWord);
                currentText = overlapSlice ? `${overlapSlice}${sentence}` : sentence;
                currentStartPage = pageItem.page;
              } else {
                // Single sentence is huge, split on word boundaries
                const words = Array.from(segmenterWord.segment(sentence)).map((w) => w.segment);
                for (const word of words) {
                  if (currentText.length + word.length <= targetChars) {
                    currentText += word;
                  } else {
                    chunks.push({
                      idx: chunkIdx++,
                      page: currentStartPage,
                      text: currentText.trim(),
                      charCount: currentText.trim().length,
                    });
                    currentText = word;
                    currentStartPage = pageItem.page;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (currentText.trim().length > 0) {
    chunks.push({
      idx: chunkIdx++,
      page: currentStartPage,
      text: currentText.trim(),
      charCount: currentText.trim().length,
    });
  }

  return chunks;
}

function getSafeOverlap(
  text: string,
  desiredOverlapChars: number,
  segmenter: Intl.Segmenter,
): string {
  if (text.length <= desiredOverlapChars) {
    return text;
  }
  const slice = text.slice(-desiredOverlapChars);
  // Find first clean word boundary in slice so we don't start mid-cluster
  const segments = Array.from(segmenter.segment(slice));
  if (segments.length > 1) {
    // drop the first partial segment
    return segments
      .slice(1)
      .map((s) => s.segment)
      .join("")
      .trim();
  }
  return slice.trim();
}
