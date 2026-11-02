import type { FlashcardItem } from "@/api/types";
import { FlashCard } from "@/components/ui/FlashCard";
import { RatingButtons, ratingLabel } from "@/components/ui/RatingButtons";
import i18n from "@/i18n";
import { lightPaperTheme } from "@/theme/paperTheme";
/**
 * Flashcard component tests (contract Section 9.6 / 13):
 *  - the card shows the question and flips to the answer
 *  - the hint is revealed on demand
 *  - the four ratings are offered and reported
 */
import { fireEvent, render, screen } from "@testing-library/react-native";
import type React from "react";
import { PaperProvider } from "react-native-paper";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

function withTheme(node: React.ReactElement) {
  return <PaperProvider theme={lightPaperTheme}>{node}</PaperProvider>;
}

const card: FlashcardItem = {
  id: "card-1",
  front: "อะไรคือ Photosynthesis",
  back: "กระบวนการสร้างอาหารของพืชด้วยแสงอาทิตย์",
  hint: "เกี่ยวกับพืช",
  sourceRefs: [{ chunkId: "chunk-2", page: 3, quote: null }],
} as FlashcardItem;

describe("FlashCard", () => {
  it("shows the question first", async () => {
    await render(withTheme(<FlashCard card={card} />));

    expect(screen.getByText(card.front)).toBeTruthy();
    expect(screen.queryByText(card.back)).toBeNull();
  });

  it("flips to the answer when tapped", async () => {
    await render(withTheme(<FlashCard card={card} />));

    await fireEvent.press(screen.getByRole("button"));

    expect(screen.getByText(card.back)).toBeTruthy();
    expect(screen.queryByText(card.front)).toBeNull();
  });

  it("flips back to the question", async () => {
    await render(withTheme(<FlashCard card={card} />));

    await fireEvent.press(screen.getByRole("button"));
    await fireEvent.press(screen.getByRole("button"));

    expect(screen.getByText(card.front)).toBeTruthy();
  });

  it("reveals the hint only when it is requested", async () => {
    await render(withTheme(<FlashCard card={card} />));

    expect(screen.queryByText(`💡 ${card.hint}`)).toBeNull();

    await fireEvent.press(screen.getByText(`💡 ${i18n.t("study.hint")}`));

    expect(screen.getByText(`💡 ${card.hint}`)).toBeTruthy();
  });

  it("shows the source references on the back of the card", async () => {
    await render(withTheme(<FlashCard card={card} sourceId="src-1" />));

    await fireEvent.press(screen.getByRole("button"));

    expect(screen.getByText(/หน้า 3/)).toBeTruthy();
  });
});

describe("RatingButtons", () => {
  it("offers the four ratings of the contract", async () => {
    await render(withTheme(<RatingButtons onRate={jest.fn()} />));

    for (const rating of ["again", "hard", "good", "easy"] as const) {
      expect(screen.getByTestId(`rating-${rating}`)).toBeTruthy();
      expect(screen.getByText(ratingLabel(rating))).toBeTruthy();
    }
  });

  it("reports the chosen rating", async () => {
    const onRate = jest.fn();
    await render(withTheme(<RatingButtons onRate={onRate} />));

    await fireEvent.press(screen.getByTestId("rating-good"));

    expect(onRate).toHaveBeenCalledWith("good");
  });

  it("does not report anything while the buttons are disabled", async () => {
    const onRate = jest.fn();
    await render(withTheme(<RatingButtons onRate={onRate} disabled />));

    await fireEvent.press(screen.getByTestId("rating-again"));

    expect(onRate).not.toHaveBeenCalled();
  });
});
