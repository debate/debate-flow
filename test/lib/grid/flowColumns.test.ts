import { describe, expect, it } from "vitest";

import { EVENTS, getEvent, speechOrder, type EventId } from "@/lib/format/events";
import {
    columnsForFlowSheet,
    crossExColumns,
    crossExEnterMove,
    headerSettings,
    spacerColumns,
    speechOffset,
} from "@/lib/grid/flowColumns";
import { makeCxFlowSheet, makeFlowRound, makeFlowSheet } from "@/lib/model/flow";

const flowSheet = (group: "aff" | "neg") => makeFlowSheet({ title: "1.", group, order: 0 });

describe("crossExEnterMove", () => {
    const walk = (start: [number, number], steps: number, width: number, backward = false) => {
        const path = [start];
        let [row, col] = start;
        for (let i = 0; i < steps; i++) {
            const d = crossExEnterMove(col, row, width, backward);
            row += d.row;
            col += d.col;
            path.push([row, col]);
        }
        return path;
    };

    it("alternates question and answer, dropping a row after each answer", () => {
        expect(walk([0, 2], 4, 4)).toEqual([
            [0, 2],
            [0, 3],
            [1, 2],
            [1, 3],
            [2, 2],
        ]);
    });

    it("retraces the same path backward and stops at the pair's first cell", () => {
        expect(walk([1, 3], 4, 4, true)).toEqual([
            [1, 3],
            [1, 2],
            [0, 3],
            [0, 2],
            [0, 2],
        ]);
    });

    it("moves straight down in an overflow column past the pairs", () => {
        expect(crossExEnterMove(4, 3, 4, false)).toEqual({ row: 1, col: 0 });
        expect(crossExEnterMove(4, 3, 4, true)).toEqual({ row: -1, col: 0 });
    });
});

describe("columnsForFlowSheet", () => {
    it("policy aff sheets show all seven speeches", () => {
        const round = makeFlowRound({});
        expect(columnsForFlowSheet(round, flowSheet("aff")).map((c) => c.name)).toEqual([
            "1AC",
            "1NC",
            "2AC",
            "Block",
            "1AR",
            "2NR",
            "2AR",
        ]);
    });

    it("policy neg sheets start at the 1NC", () => {
        const round = makeFlowRound({});
        const cols = columnsForFlowSheet(round, flowSheet("neg"));
        expect(cols[0].id).toBe("1nc");
        expect(cols).toHaveLength(6);
    });

    it("pf gives the first-speaking side 8 columns and the other side 7", () => {
        const affFirst = makeFlowRound({ event: "pf", firstSide: "aff" });
        expect(columnsForFlowSheet(affFirst, flowSheet("aff"))).toHaveLength(8);
        expect(columnsForFlowSheet(affFirst, flowSheet("neg"))).toHaveLength(7);

        const negFirst = makeFlowRound({ event: "pf", firstSide: "neg" });
        expect(columnsForFlowSheet(negFirst, flowSheet("neg"))).toHaveLength(8);
        expect(columnsForFlowSheet(negFirst, flowSheet("aff"))).toHaveLength(7);
        expect(columnsForFlowSheet(negFirst, flowSheet("neg"))[0].short).toBe("NC");
    });

    it("an explicit startSpeechId wins; unknown ids fall back to the full order", () => {
        const round = makeFlowRound({});
        const sheet = { ...flowSheet("aff"), startSpeechId: "2ac" };
        expect(columnsForFlowSheet(round, sheet)[0].id).toBe("2ac");
        const bogus = { ...sheet, startSpeechId: "nope" };
        expect(columnsForFlowSheet(round, bogus)).toHaveLength(7);
    });

    it("legacy policy startSpeechId values still resolve", () => {
        const round = makeFlowRound({});
        const sheet = { ...flowSheet("neg"), startSpeechId: "1nc" };
        expect(columnsForFlowSheet(round, sheet)[0].id).toBe("1nc");
    });

    it("parli neg sheets start at the LOC and end on the PMR", () => {
        const round = makeFlowRound({ event: "parli" });
        expect(columnsForFlowSheet(round, flowSheet("aff")).map((c) => c.short)).toEqual([
            "PM",
            "LOC",
            "MGC",
            "Block",
            "PMR",
        ]);
        expect(columnsForFlowSheet(round, flowSheet("neg")).map((c) => c.id)).toEqual([
            "loc",
            "mgc",
            "block",
            "pmr",
        ]);
    });

    it("an event with no cross-examination derives no cross-ex columns", () => {
        const round = makeFlowRound({ event: "parli" });
        expect(crossExColumns(EVENTS.parli, "aff")).toEqual([]);
        expect(columnsForFlowSheet(round, makeCxFlowSheet())).toEqual([]);
    });

    it("cx sheets derive periods from the event", () => {
        const policy = makeFlowRound({});
        const policyCols = columnsForFlowSheet(policy, makeCxFlowSheet());
        expect(policyCols).toHaveLength(8);
        expect(policyCols[0]).toMatchObject({ name: "Question", side: "neg", group: "1AC CX" });

        const pf = makeFlowRound({ event: "pf", firstSide: "neg" });
        const pfCols = columnsForFlowSheet(pf, makeCxFlowSheet("Cross-Examination"));
        expect(pfCols).toHaveLength(6);
        expect(pfCols.map((c) => c.group)).toEqual([
            "First Cross",
            "First Cross",
            "Second Cross",
            "Second Cross",
            "Grand Cross",
            "Grand Cross",
        ]);
        expect(pfCols[0].side).toBe("neg");
    });

    it("ld cx alternates the questioning side per period", () => {
        const ld = makeFlowRound({ event: "ld" });
        const cols = columnsForFlowSheet(ld, makeCxFlowSheet());
        expect(cols).toHaveLength(4);
        expect(cols).toMatchObject([
            { name: "Question", side: "neg", group: "1AC CX" },
            { name: "Response", side: "aff", group: "1AC CX" },
            { name: "Question", side: "aff", group: "1NC CX" },
            { name: "Response", side: "neg", group: "1NC CX" },
        ]);
    });

    it("pf crossfire columns are labelled by side; policy stays Question/Response", () => {
        const pf = makeFlowRound({ event: "pf", firstSide: "aff" });
        const pfCols = columnsForFlowSheet(pf, makeCxFlowSheet("Cross-Examination"));
        expect(pfCols.slice(0, 2)).toMatchObject([
            { name: "Aff", short: "Aff", side: "aff" },
            { name: "Neg", short: "Neg", side: "neg" },
        ]);

        const policy = makeFlowRound({});
        const policyCols = columnsForFlowSheet(policy, makeCxFlowSheet());
        expect(policyCols[0]).toMatchObject({ name: "Question", side: "neg" });
    });
});

describe("speechOffset", () => {
    it("is zero for the sheet that opens the round and one for the other side", () => {
        const round = makeFlowRound({});
        expect(speechOffset(round, flowSheet("aff"))).toBe(0);
        expect(speechOffset(round, flowSheet("neg"))).toBe(1);
    });

    it("follows a speaking-order swap", () => {
        const negFirst = makeFlowRound({ event: "pf", firstSide: "neg" });
        expect(speechOffset(negFirst, flowSheet("neg"))).toBe(0);
        expect(speechOffset(negFirst, flowSheet("aff"))).toBe(1);
    });

    it("counts every speech left of an explicit startSpeechId", () => {
        const round = makeFlowRound({});
        expect(speechOffset(round, { ...flowSheet("aff"), startSpeechId: "2ac" })).toBe(2);
        expect(speechOffset(round, { ...flowSheet("neg"), startSpeechId: "2nr" })).toBe(5);
    });

    it("is zero for a cx sheet and for a start speech the order does not hold", () => {
        const round = makeFlowRound({});
        expect(speechOffset(round, makeCxFlowSheet())).toBe(0);
        expect(speechOffset(round, { ...flowSheet("aff"), startSpeechId: "nope" })).toBe(0);
        // A cx sheet carries the aff group, so a round the neg opens is the
        // case that tells the kind apart from a flow sheet: read as one, it
        // would start at the aff's first speech, a column into the order.
        const negFirst = makeFlowRound({ event: "pf", firstSide: "neg" });
        expect(speechOffset(negFirst, makeCxFlowSheet())).toBe(0);
    });

    it("accounts for exactly the columns a sheet does not show", () => {
        for (const event of Object.keys(EVENTS) as EventId[]) {
            for (const firstSide of ["aff", "neg"] as const) {
                const round = makeFlowRound({ event, firstSide });
                const total = speechOrder(getEvent(event), firstSide).length;
                for (const group of ["aff", "neg"] as const) {
                    const sheet = flowSheet(group);
                    const shown = columnsForFlowSheet(round, sheet).length;
                    expect(speechOffset(round, sheet) + shown).toBe(total);

                    // group is a replicated register: a peer can put anything
                    // on the wire, and startIndex falls the value back to aff.
                    const garbage = { ...sheet, group: "garbage" as never };
                    const garbageShown = columnsForFlowSheet(round, garbage).length;
                    expect(speechOffset(round, garbage) + garbageShown).toBe(total);
                }
            }
        }
    });
});

describe("spacerColumns", () => {
    it("is the speeches a sheet does not show, in speaking order", () => {
        const round = makeFlowRound({});
        expect(spacerColumns(round, flowSheet("aff"))).toEqual([]);
        expect(spacerColumns(round, flowSheet("neg")).map((c) => c.id)).toEqual(["1ac"]);
        expect(
            spacerColumns(round, { ...flowSheet("aff"), startSpeechId: "block" }).map((c) => c.id),
        ).toEqual(["1ac", "1nc", "2ac"]);
    });

    it("carries each speech's own side, not the sheet's", () => {
        const round = makeFlowRound({});
        const sheet = { ...flowSheet("aff"), startSpeechId: "2ac" };
        expect(spacerColumns(round, sheet).map((c) => c.side)).toEqual(["aff", "neg"]);
    });

    it("is empty for a cx sheet and for a start speech the order does not hold", () => {
        const round = makeFlowRound({});
        expect(spacerColumns(round, makeCxFlowSheet())).toEqual([]);
        expect(spacerColumns(round, { ...flowSheet("aff"), startSpeechId: "nope" })).toEqual([]);
    });

    it("partitions the round's speaking order with the columns a sheet shows", () => {
        for (const event of Object.keys(EVENTS) as EventId[]) {
            for (const firstSide of ["aff", "neg"] as const) {
                const round = makeFlowRound({ event, firstSide });
                const order = speechOrder(getEvent(event), firstSide).map((c) => c.id);
                for (const group of ["aff", "neg"] as const) {
                    const sheet = flowSheet(group);
                    const spacers = spacerColumns(round, sheet).map((c) => c.id);
                    const shown = columnsForFlowSheet(round, sheet).map((c) => c.id);
                    expect([...spacers, ...shown]).toEqual(order);
                    expect(spacers.length).toBe(speechOffset(round, sheet));
                }
            }
        }
    });
});

describe("headerSettings", () => {
    it("flow sheets use short header labels", () => {
        const round = makeFlowRound({ event: "pf" });
        const sheet = flowSheet("aff");
        const cols = columnsForFlowSheet(round, sheet);
        expect(headerSettings(sheet, cols).colHeaders).toEqual([
            "AC",
            "NC",
            "AR",
            "NR",
            "AS",
            "NS",
            "AF",
            "NF",
        ]);
    });

    it("pads overflow columns past the derived set with blank labels", () => {
        const round = makeFlowRound({ event: "pf" });
        const sheet = flowSheet("aff");
        const cols = columnsForFlowSheet(round, sheet);
        const headers = headerSettings(sheet, cols, cols.length + 2).colHeaders as string[];
        expect(headers).toHaveLength(cols.length + 2);
        expect(headers.slice(cols.length)).toEqual(["", ""]);
    });

    it("cx sheets get a period tier above Question/Response", () => {
        const round = makeFlowRound({});
        const sheet = makeCxFlowSheet();
        const cols = columnsForFlowSheet(round, sheet);
        const settings = headerSettings(sheet, cols);
        expect(settings.colHeaders).toBe(true);
        expect(settings.nestedHeaders?.[0]).toEqual([
            { label: "1AC CX", colspan: 2 },
            { label: "1NC CX", colspan: 2 },
            { label: "2AC CX", colspan: 2 },
            { label: "2NC CX", colspan: 2 },
        ]);
    });
});
