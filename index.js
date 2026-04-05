const axios = require("axios");
const cheerio = require("cheerio");

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const SITE_URL = "https://mangasbrasuka.com.br/";

let vistos = new Set();

async function checkSite() {
  try {
    const res = await axios.get(SITE_URL);
    const $ = cheerio.load(res.data);

    let caps = [];

    $("a").each((i, el) => {
      const title = $(el).text().trim();
      const link = $(el).attr("href");

      if (!title || !link) return;

      const texto = title.toLowerCase();

      if (
        (texto.includes("cap") || texto.includes("chapter")) &&
        link.includes("manga")
      ) {
        caps.push({
          title,
          link: link.startsWith("http") ? link : SITE_URL + link
        });
      }
    });

    // remove duplicados
    const únicos = [];
    const usado = new Set();

    for (const c of caps) {
      if (!usado.has(c.link)) {
        usado.add(c.link);
        únicos.push(c);
      }
    }

    const recentes = únicos.slice(0, 10);

    // primeira execução
    if (vistos.size === 0) {
      recentes.forEach(c => vistos.add(c.link));
      console.log("Inicializado.");
      return;
    }

    const novos = recentes.filter(c => !vistos.has(c.link));

    if (novos.length > 0) {
      for (const cap of novos) {

        let nome = cap.title;
        let numero = "";

        const match = cap.title.match(/(.*?)(cap[^\d]*\d+.*)/i);

        if (match) {
          nome = match[1].trim();
          numero = match[2].trim();
        }

        await axios.post(WEBHOOK_URL, {
          username: "alice",
          content: `📢 Atualização
Acabou de sair o capítulo ${numero}
Obra: ${nome}
Leia: ${cap.link}`
        });

        console.log("Enviado:", cap.title);
      }

      vistos = new Set(recentes.map(c => c.link));
    } else {
      console.log("Sem novidades.");
    }

  } catch (err) {
    console.log("Erro:", err.message);
  }
}

// intervalo (5 minutos)
setInterval(checkSite, 5 * 60 * 1000);

// inicia
checkSite();