const express = require('express');
const Groq = require('groq-sdk');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Mentagen Smart Bot is Running!'));
app.listen(port);

// Key mpya iliyosasishwa
const GROQ_KEY = "Gsk_bgRnjahfPLTSpVi0dtMdWGdyb3FYMMEj4d2XVRp3L7XoVb19gXy1";
const groq = new Groq({ apiKey: GROQ_KEY });

const EMOJI_LIST = ['⚡', '✨', '🪐', '🚀', '💎', '👑', '🔥', '🏆', '🎯', '🌀', '🧿', '⚜️', '🖤', '🤍', '🦁', '🔮', '🫧', '🔱', '🪶', '💫'];

const FALLBACK_MENU = `Karibu Mentagen! 🚀
Msaidizi wetu atawasiliana nawe hivi punde.

Huduma zetu ni:
1. Web Development
2. Application Building
3. Graphics Designing
4. Automation Bots & AI Agents
5. Ads Management
6. Filmmaker
7. Social Media Marketing

Kwa masuala ya bei na malipo, tafadhali subiri kidogo Paschal atawasiliana nawe moja kwa moja.`;

const SYSTEM_PROMPT = `
Wewe ni Msaidizi Rasmi wa Kiprofeshono wa Mentagen (Paschal).

HUDUMA ZA MENTAGEN:
1. Web Development
2. Application Building
3. Graphics Designing
4. Automation Bots & AI Agents
5. Ads Management
6. Filmmaker
7. Social Media Marketing

MWONGOZO WA LUGHA NA MAJIBU:
1. KUTAMBUA LUGHA: Angalia lugha ya meseji ya mteja. Kama kaandika Kiingereza, JIBU KWA KIINGEREZA KIKAMILIFU (100% English). Kama kaandika Kiswahili, JIBU KWA KISWAHILI KIKAMILIFU (100% Swahili).
2. Kuwa mtaalamu, stahimilivu, na unayejibu kwa kifupi na usahihi wa hali ya juu.
3. KUHUSU BEI / MALIPO / MIAMALA: Mteja akiuliza kuhusu bei au malipo:
   - Kwa Kiswahili: "Kuhusu masuala ya bei na malipo, tafadhali subiri kidogo Paschal (Mentagen) atawasiliana nawe moja kwa moja hivi punde."
   - Kwa Kiingereza: "Regarding pricing and payments, please hold on a moment—Paschal (Mentagen) will get back to you directly shortly."
`;

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

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) initBot();
    } else if (connection === 'open') {
      console.log('\n========================================');
      console.log('BOT IKO LIVE NA AI YA GROQ IPOTAYARI!');
      console.log('========================================\n');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      const sender = msg.key.remoteJid;

      if (sender === 'status@broadcast') {
        try {
          await sock.readMessages([msg.key]);
          const randomEmoji = EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)];
          await sock.sendMessage(sender, { react: { text: randomEmoji, key: msg.key } }, { statusJidList: [msg.key.participant] });
          console.log(`Status reaction: ${randomEmoji}`);
        } catch (err) {}
        continue;
      }

      if (sender.endsWith('@g.us') || msg.key.fromMe) continue;

      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || '';

      if (text.trim()) {
        try {
          const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: text }],
            model: 'llama-3.1-8b-instant',
          });
          const reply = chatCompletion.choices[0]?.message?.content;
          if (reply) {
            await sock.sendMessage(sender, { text: reply }, { quoted: msg });
          }
        } catch (err) {
          console.error("Groq AI Error:", err.message);
          await sock.sendMessage(sender, { text: FALLBACK_MENU }, { quoted: msg });
        }
      }
    }
  });
}
initBot();
