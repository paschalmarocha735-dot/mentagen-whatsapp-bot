const express = require('express');
const Groq = require('groq-sdk');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');

const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Mentagen Bot is Running!'));
app.listen(port);

const GROQ_KEY = process.env.GROQ_API_KEY || "gsks_TQCqqDGSyp9Hqp41iHw6dyb3FYFYDMIAMAIneCoLtPDK2Iaaaa";
const groq = new Groq({ apiKey: GROQ_KEY });
const SYSTEM_PROMPT = "Wewe ni Msaidizi Rasmi wa Mentagen (Paschal). Jibu kwa lugha ya mteja (Swahili/English). Akiuliza bei, mwambie asubiri Paschal.";

const PHONE_NUMBER = "255676969704"; 

async function initBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: require('pino')({ level: 'silent' }),
    browser: ["Ubuntu", "Chrome", "110.0.5481.177"]
  });

  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered) {
    await delay(6000); // Subiri sekunde 6 ili ikae sawa
    try {
      let code = await sock.requestPairingCode(PHONE_NUMBER);
      code = code?.match(/.{1,4}/g)?.join("-") || code;
      console.log("\n====================================");
      console.log(`PAIRING CODE YAKO NI: ${code}`);
      console.log("====================================\n");
    } catch (err) {
      console.error("FAILS TO GET PAIRING CODE:", err.message);
    }
  }

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const sender = msg.key.remoteJid;
      if (sender === 'status@broadcast') continue;

      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      if (!text.trim()) continue;

      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: text }],
          model: 'llama-3.1-8b-instant',
        });
        const reply = chatCompletion.choices[0]?.message?.content;
        if (reply) await sock.sendMessage(sender, { text: reply }, { quoted: msg });
      } catch (err) {
        console.error("Groq AI Error:", err.message);
      }
    }
  });
}

initBot();
