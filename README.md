A [Deno](https://deno.com) script that checks the mint audit API every 60 seconds and posts any changes to Nostr.

An example can be found [here](https://njump.me/npub1cashu0thfukl57lgwtarn7h4jrzrg2e346zc8sjvjd8u5hheds0qlhpt92)

Running:
- Install the deno runtime `curl -fsSL https://deno.land/install.sh | sh`
- Clone the repo
- create a `.env` file with the nsec of your bot as `NOSTR_PRIVATE_KEY` (see example.env)
- `deno run --allow-read --allow-write="./mints.json" --allow-write="./message.txt" --allow-env --allow-net --watch main.ts`
Permissions:
Read: Required to read the nsec from .env and saved mint info
Write: Required to write to mints.json
env: Required for accessing env vars
Net: Required for fetching mint info and posting to Nostr