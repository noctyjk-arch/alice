const axios = require("axios");
const cheerio = require("cheerio");
const { Client, GatewayIntentBits } = require("discord.js");

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const SITE_URL = "https://mangasbrasuka.com.br/";

const OWNER_ID = "1400164749655674953";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let vistos = new Set();
let inicializado = false;

// ----------------------
// DISCORD BOT CONTROLES
// ----------------------
client.on("ready", () => {
  console.log("Bot de controle online");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!")) return;

  const args = message.content.slice(1).trim().split(" ");
  const cmd = args.shift().toLowerCase();

  const isOwner = message.author.id === OWNER_ID;

  // 🔒 RESTART
  if (cmd === "restart") {
    if (!isOwner) return message.reply("Sem permissão.");

    await message.reply("Reiniciando...");
    process.exit(0);
  }

  // 🔒 PING / STATUS
  if (cmd === "ping" || cmd === "status") {
    if (!isOwner) return message.reply("Sem permissão.");

    const sent = await message.reply("Calculando...");

    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiPing = Math.round(client.ws.ping);

    await sent.edit(
      `📊 Status

⏱️ Latência: ${latency}ms
🌐 API Ping: ${apiPing}ms`
    );
  }

  // 🔒 BANCO (simples debug do processo)
  if (cmd === "banco") {
    if (!isOwner) return message.reply("Sem permissão.");

    return message.reply(
      `🧠 Bot ativo\n🕒 Uptime: ${Math.floor(process.uptime())}s\n🔁 Vistos: ${vistos.size}`
    );
  }
});

// ----------------------
// SCRAPER + WEBHOOK
// ----------------------
async function checkSite() {
  try {
    const res = await axios.get(SITE_URL);
    const $ = cheerio.load(res.data);

    let caps = [];

    $("a").each((i, el) => {
      const link = $(el).attr("href");
      if (!link) return;

      if (link.includes("/capitulo-")) {

        const fullLink = link.startsWith("http")
          ? link
          : SITE_URL + link;

        const partes = fullLink.split("/manga/")[1]?.split("/");
        if (!partes) return;

        const nomeBase = partes[0].replace(/-/g, " ");
        const nome = nomeBase.toLowerCase();
        const nomeBonito = nomeBase.replace(/\b\w/g, l => l.toUpperCase());

        const capMatch = fullLink.match(/capitulo-(\d+)/i);
        const numero = capMatch ? `Capítulo ${capMatch[1]}` : "";

        caps.push({ nome, nomeBonito, numero, link: fullLink });
      }
    });

    const únicos = [];
    const usado = new Set();

    for (const c of caps) {
      if (!usado.has(c.link)) {
        usado.add(c.link);
        únicos.push(c);
      }
    }

    const recentes = únicos.slice(0, 10);

    if (!inicializado) {
      recentes.forEach(c => vistos.add(c.link + c.numero));
      inicializado = true;
      console.log("Inicializado sem enviar.");
      return;
    }

    const novos = recentes.filter(c => !vistos.has(c.link + c.numero));

    if (novos.length > 0) {
      for (const cap of novos) {

        await axios.post(WEBHOOK_URL, {
          username: "alice",
          content: `📢 Atualização
Acabou de sair o ${cap.numero} da
Obra: ${cap.nomeBonito}
Está disponível para ler em: ${cap.link}`
        });

        console.log("Enviado:", cap.nome, cap.numero);
      }

      vistos = new Set(recentes.map(c => c.link + c.numero));
    } else {
      console.log("Sem novidades.");
    }

  } catch (err) {
    console.log("Erro:", err.message);
  }
}

setInterval(checkSite, 5 * 60 * 1000);
checkSite();

// start discord bot
client.login(process.env.TOKEN);