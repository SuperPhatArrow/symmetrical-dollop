import type { Mint } from "./Mint.ts";

const lastMintsPath = `${Deno.cwd()}/mints.json`;

export const getSavedMints = () => {
    const mints = Deno.readTextFileSync(lastMintsPath);
    return JSON.parse(mints) as Mint[];
};

export const saveMints = (mints: Mint[]) => {
    Deno.writeTextFileSync(lastMintsPath, JSON.stringify(mints));
}