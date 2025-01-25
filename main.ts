import { getSavedMints, saveMints } from "./fs.ts";
import { Mint } from "./Mint.ts";
import { Nostr } from "./nostr/nostr.ts";
import Relay from "./nostr/relay.ts";
import * as env from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { Swap } from "./Swap.ts";
import { setupLog } from "./log.ts";


const { NOSTR_PRIVATE_KEY, DEBUG, RELAYS } = await env.load();
const debug = !!DEBUG;
const log = setupLog(debug);
if (!NOSTR_PRIVATE_KEY) {
  log("NOSTR_PRIVATE_KEY not found in .env file");
  Deno.exit(1);
}
if (!RELAYS) {
  log("RELAYS not found in .env file");
  Deno.exit(1);
}
const swapState = {
  OK: "✅",
  UNKNOWN: "❓",
  ERROR: "❌",
};

const getSwaps = async () => {
  const newSwaps: Swap[] = await fetch(
    "https://api.audit.8333.space/swaps/?limit=1000",
  ).then((r) => r.json()).catch(() => []);
  const sortedSwaps = newSwaps.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return sortedSwaps;
};

let allSwaps = await getSwaps();

const getLast10Swaps = (mintId: number) => {
  return allSwaps
    .sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .filter((swap) => swap.from_id === mintId || swap.to_id === mintId)
    .slice(0, 10);
};

const getFailedSwapsMessage = (failedSwaps: Swap[]) => {
  let msg = "";
  failedSwaps.forEach((swap) => {
    const swapsFromMint = getLast10Swaps(swap.from_id);
    const swapsToMint = getLast10Swaps(swap.to_id);
    msg += `🚨 New Failed Swap for ${swap.amount} sats (${swap.fee} sat${swap.fee === 1 ? "" : "s"} fee) at ${swap.created_at.replace("T", " ")}\n${swapState[swap.state]} ${swap.from_url} -> ${swap.to_url} ${
      swap.error || ""
    }\n`;
    msg += `\nLast 10 swaps involving ${swap.from_url} (Success rate ${
      swapsFromMint.filter((s) => s.state === "OK").length
    }/${swapsFromMint.length}):\n`;
    msg += swapsFromMint.map((s) =>
      `${swapState[s.state]} ${s.from_url} -> ${s.to_url} at ${s.created_at.replace("T", " ")} ${
        s.error || ""
      }`
    ).join("\n");
    msg += `\n\nLast 10 swaps involving ${swap.to_url} (Success rate ${
      swapsToMint.filter((s) => s.state === "OK").length
    }/${swapsToMint.length}):\n`;
    msg += swapsToMint.map((s) =>
      `${swapState[s.state]} ${s.from_url} -> ${s.to_url} at ${s.created_at.replace("T", " ")} ${
        s.error || ""
      }`
    ).join("\n");
  });
  return msg;
};


const nostr = new Nostr();

nostr.privateKey = NOSTR_PRIVATE_KEY;

const relays = RELAYS.split(" ");

for (const relay of relays) {
  nostr.relayList.push({
    name: relay,
    url: relay,
  });
}

nostr.on(
  "relayConnected",
  (relay: Relay) => log("Relay connected.", relay.name),
);
nostr.on("relayError", (err: Error, relay: Relay | null) => log("Relay error;", err, relay?.name));
nostr.on("relayNotice", (notice: string[]) => log("Notice", notice));

nostr.debugMode = debug;

await nostr.connect();
await nostr.disconnect();

let oldMints: Mint[] = getSavedMints();
let threadMessages: string[] = [];

const getNpub = (mint: Mint) => {
  try {
    const info: { contact: { method: string; info: string }[] } = JSON.parse(
      mint.info,
    );
    const npub = info.contact.find((contact) =>
      contact.method === "nostr"
    )?.info || "";
    return npub.length > 10 ? npub : "";
  } catch (_) {
    return "";
  }
};

const getPercentOfOKMints = (mints: Mint[]) =>
  `${
    (
      (mints.filter((mint) => mint.state === "OK").length * 100) /
      mints.length
    ).toFixed(0)
  }% of ${mints.length} mints are OK`;

const getChangedMints = (mints: Mint[]) =>
  [
    ...new Set(
      mints
        .filter(
          (mint) =>
            mint.state !==
              oldMints.find((oldMint) => oldMint.id === mint.id)?.state,
        )
        .sort((a, b) => {
          const stateOrder = { OK: 0, UNKNOWN: 1, ERROR: 2 };
          return stateOrder[a.state] - stateOrder[b.state];
        })
        .map(
          (mint) =>
            `${mint.state === "OK" ? "🆙" : "🚨"} ${mint.name} ${
              mint.state === "OK" ? "seems OK! See below." : "might have problems! See below."
            } ${getNpub(mint)}`,
        ),
    ),
  ].join("\n");

const checkMints = async () => {
  try {
    const response = await fetch("https://api.audit.8333.space/mints/?limit=10000");
    const mints: Mint[] = await response.json();
    if (oldMints.length === 0) {
      // first run
      oldMints = mints;
      saveMints(mints);
    }
    const mintList = mints
      .map(
        (mint) =>
          `${swapState[mint.state]} ${mint.name} - ${mint.url} ${
            oldMints.some((oldMint) => oldMint.id === mint.id) ? "" : " ⭐ (new!)"
          }
Last 10 swaps for ${mint.name}
${getLast10Swaps(mint.id).map((s) => `${swapState[s.state]} ${s.from_url} -> ${s.to_url} at ${s.created_at.replace("T", " ")} ${s.error || ""}`).join("\n")}    

`,
      )
      
    const changes = getChangedMints(mints);
    const nostrMsg = `${changes ? `Mint Status Changes\n\n${changes}` : ""}
${getPercentOfOKMints(mints)}

${mintList.join("\n\n")}

Help support Round Robin Cashu Audit! https://audit.8333.space/`;
    oldMints = mints;
    saveMints(mints);
    return nostrMsg;
  } catch (error) {
    log("ERROR: ", error);
    return "";
  }
};

let lastTime = Date.now();

const doIt = async () => {
  const timeNow = Date.now();
  const timeDiff = timeNow - lastTime;
  lastTime = timeNow;
  log(`${new Date().toISOString().replace("T", " ")} - Last run ${timeDiff}ms ago`);
  try {
    allSwaps = await getSwaps();
    const lastMinuteSwaps = allSwaps.filter((swap) =>
      new Date(swap.created_at).getTime() > Date.now() - 60000
    );
    if (lastMinuteSwaps.length) log(lastMinuteSwaps[0]);
    const failedSwaps = lastMinuteSwaps.filter(swap => swap.state !== 'OK')
    if (failedSwaps.length) {
      threadMessages = []
      threadMessages.push(getFailedSwapsMessage(failedSwaps))
      threadMessages.push(await checkMints());
      await nostr.reconnect();
      await nostr.sendThreadPost(threadMessages);
      await nostr.disconnect();
      threadMessages = [];
    }
  } catch (error) {
    log(error);
  }
};

const main = () => {
  doIt();
  setInterval(doIt, 59975);
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  main();
}
