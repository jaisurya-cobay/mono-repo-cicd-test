import { createServer } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
createServer().listen(port, () => console.log(`server listening on ${port}`));
// OMS-40 hotfix
// OMS-44 hotfix
// OMS-41
