import { render, waitFor } from "@testing-library/react";
import type Handsontable from "handsontable";
import { afterEach, describe, expect, it, vi } from "vitest";

import HotGrid from "@/components/flow/HotGrid";
import { getActiveHot } from "@/lib/grid/hotInstance";
import { makeFlowRound } from "@/lib/model/flow";
import { useFlowStore } from "@/lib/store/useFlowStore";

const round = makeFlowRound();
const cxId = round.sheets.find((s) => s.kind === "cx")!.id;
const flowId = round.sheets.find((s) => s.kind !== "cx")!.id;

async function mount(sheetId: string, cxEnterAlternates: boolean) {
    useFlowStore.setState({
        round,
        activeSheetId: sheetId,
        splitSheetId: null,
        cxEnterAlternates,
    });
    render(<HotGrid sheetId={sheetId} pane={1} />);
    await waitFor(() => expect(getActiveHot()).not.toBeNull());
    return getActiveHot()!;
}

function press(hot: Handsontable, key: string, shiftKey = false) {
    const target = document.activeElement ?? hot.rootElement;
    target.dispatchEvent(
        new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }),
    );
}

function at(hot: Handsontable) {
    const cell = hot.getSelectedRangeLast()!.highlight;
    return [cell.row, cell.col];
}

afterEach(() => {
    useFlowStore.setState({ cxEnterAlternates: false });
});

vi.setConfig({ testTimeout: 30_000 });

describe("Enter on the cross-ex sheet", () => {
    it("alternates question and answer with the setting on", async () => {
        const hot = await mount(cxId, true);
        hot.selectCell(0, 2);
        const path = [at(hot)];
        for (let i = 0; i < 3; i++) {
            press(hot, "Enter");
            path.push(at(hot));
        }
        expect(path).toEqual([
            [0, 2],
            [0, 3],
            [1, 2],
            [1, 3],
        ]);

        press(hot, "Enter", true);
        expect(at(hot)).toEqual([1, 2]);
        press(hot, "Enter", true);
        expect(at(hot)).toEqual([0, 3]);
    });

    it("commits an open edit and moves to the answer", async () => {
        const hot = await mount(cxId, true);
        hot.selectCell(4, 0);
        press(hot, "F2");
        expect(hot.getActiveEditor()?.isOpened()).toBe(true);
        press(hot, "Enter");
        expect(hot.getActiveEditor()?.isOpened()).toBe(false);
        expect(at(hot)).toEqual([4, 1]);
    });

    it("moves down with the setting off", async () => {
        const hot = await mount(cxId, false);
        hot.selectCell(0, 0);
        press(hot, "Enter");
        expect(at(hot)).toEqual([1, 0]);
    });

    it("leaves a flow sheet moving down with the setting on", async () => {
        const hot = await mount(flowId, true);
        hot.selectCell(0, 0);
        press(hot, "Enter");
        expect(at(hot)).toEqual([1, 0]);
    });
});
