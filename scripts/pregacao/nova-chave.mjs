// Cria a chave do programa da pregação neste computador
// (%USERPROFILE%\.pregacao-podcast\config.json) e mostra o SQL para o banco
// aceitar essa chave. Use ao instalar o programa num computador novo:
// a chave antiga deixa de valer quando o SQL for rodado.
//   node scripts/pregacao/nova-chave.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const pasta = path.join(os.homedir(), ".pregacao-podcast");
const arq = path.join(pasta, "config.json");
fs.mkdirSync(pasta, { recursive: true });
const antes = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, "utf8")) : {};
if (antes.chave && !process.argv.includes("--trocar")) {
  console.log(`Este computador já tem chave (${arq}).`);
  console.log("Para trocar mesmo assim: node scripts/pregacao/nova-chave.mjs --trocar");
  process.exit(0);
}
const chave = "preg_" + crypto.randomBytes(24).toString("hex");
fs.writeFileSync(arq, JSON.stringify({ site: "https://www.adbelemparquealvim.org.br", ...antes, chave }, null, 2) + "\n");
const hash = crypto.createHash("sha256").update(chave).digest("hex");
console.log(`Chave salva em ${arq} (não mande para ninguém).\n`);
console.log("Agora rode no Supabase (SQL Editor):\n");
console.log(`update private.pregacao_key set key_hash = '${hash}' where id = 1;\n`);
