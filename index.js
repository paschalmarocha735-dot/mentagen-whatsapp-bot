const express = require('express');
const Groq = require('groq-sdk');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Mentagen Bot is Running!'));
app.listen(port);

const GROQ_KEY = process.env.GROQ_API_KEY || "gsks_TQCqqDGSyp9Hqp41iHw6dyb3FYFYDMIAMAIneCoLtPDK2Iaaaa";
const groq = new Groq({ apiKey: GROQ_KEY });
const SYSTEM_PROMPT = "Wewe ni Msaidizi Rasmi wa Mentagen (Paschal). Jibu kwa lugha ya mteja (Swahili/English). Akiuliza bei, mwambie asubiri Paschal.";

// NAMBA YAKO YA WHATSAPP:
const PHONE_NUMBER = "255676969704"; 

async function initBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "110.0.5481.177"]
  });

  sock.ev.on('creds.update', saveCreds);

  if (!sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        let code = await sock.requestPairingCode(PHONE_NUMBER);
        console.log(`\n====================================\nPAIRING CODE YAKO NI: ${code}\n====================================\n`);
      } catch (err) {
        console.error("Error generating pairing code:", err);
      }
    }, 4000);
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
