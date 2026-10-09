/** npm run agent:sync — same as POST /api/admin/sync-agent, from your terminal. */
import { syncAgent } from "../lib/syncAgent";
syncAgent().then((r) => { console.log(JSON.stringify(r, null, 2)); }).catch((e) => { console.error(e); process.exit(1); });
