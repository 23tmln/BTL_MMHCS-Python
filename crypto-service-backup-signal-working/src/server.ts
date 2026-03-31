import express from "express";
import router from "./api/routes";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

// Allow larger secure-state backups/restores (state blob can exceed default 100kb)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/", router);

app.listen(PORT, () => {
  console.log(`Crypto service listening on http://localhost:${PORT}`);
});