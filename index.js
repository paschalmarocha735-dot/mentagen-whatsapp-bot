const express = require('express');
const Groq = require('groq-sdk');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Mentagen Bot is Running!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `
Wewe ni Msaidizi Rasmi na wa Kiprofeshono wa Mentagen (Paschal).

Mwongozo wa Majibu Yako:
1. Jibu kwa muundo wa Professional Assistant: Mfupi, uliostahiwa, wa moja kwa moja, na ulionyooka bila maneno ya ziada.
2. Usijirudie salamu ikiwa tayari mlishasalimiana.
3. Tumia Kiswahili fasaha au Kiingereza cha kiprofeshono kulingana na lugha ya mteja/mtumiaji.
4. Unapotoa taarifa au maelekezo, yawe mafupi na yenye kueleweka mara moja.
5. KUHUSU PESA/MALIPO/BEI/MIAMALA: Ikitokea mtu akauliza kuhusu malipo au bei ya huduma, MUELEKEZE MOJA KWA MOJA KWA MENTAGEN (PASCHAL). Mwambie kwa staha na kiprofeshono: "Kuhusu masuala ya bei na malipo, tafadhali tegea kidogo Paschal (Mentagen) atawasiliana nawe moja kwa moja hivi punde."
6. Usifanye maamuzi yoyote ya kifedha wala kutoa ahadi za bei.
`;

// Emojis za kiprofeshono na za kisasa (Telegram Premium style)
const EMOJI_LIST = [
  '⚡', '✨', '🪐', '🚀', '💎', '👑', '🔥', '🏆', '🎯', '🌀',
  '🧿', '⚜️', '🖤', '🤍', '🖤', '🦁', '⚡️', '🔮', '🫧', '🔱',
  '🪶', '💫', '🤝', '💯', '🥂', '🌌', '🌠', '👑', '🕊️', '🦅'
];

async function initBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    
    const sock = makeWASocket({
      auth: state,
      browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed, reconnecting...', shouldReconnect);
        if (shouldReconnect) initBot();
      } else if (connection === 'open') {
        console.log('\n========================================');
        console.log('WhatsApp Connection Opened Successfully!');
        console.log('========================================\n');
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      
      for (const msg of messages) {
        if (!msg.message) continue;

        const sender = msg.key.remoteJid;

        // 1. AUTO VIEW STATUS WITH PREMIUM EMOJI REACT
        if (sender === 'status@broadcast') {
          try {
            await sock.readMessages([msg.key]);
            const randomEmoji = EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)];

            await sock.sendMessage(sender, {
              react: { text: randomEmoji, key: msg.key }
            }, { statusJidList: [msg.key.participant] });

            console.log(`Status imesomwa & kuwekewa reaction: ${randomEmoji}`);
          } catch (err) {
            console.error('Error handling status:', err.message);
          }
          continue;
        }

        // 2. KUZUIA BOT ISIJIBU KWENYE MAGROUP
        if (sender.endsWith('@g.us')) {
          continue;
        }

        // 3. ANTI-DELETE DETECTOR
        if (msg.message.protocolMessage && msg.message.protocolMessage.type === 0) {
          console.log('Meseji imefutwa na mtumiaji!');
          continue;
        }

        // Usijijibu mwenyewe
        if (msg.key.fromMe) continue;

        // 4. KUCHUKUA TEXT KUTOKA KWENYE MESEJI ZA KAWAIDA
        const text = 
          msg.message.conversation || 
          msg.message.extendedTextMessage?.text || 
          msg.message.imageMessage?.caption || 
          msg.message.videoMessage?.caption || 
          '';

        if (text.trim()) {
          console.log(`Meseji binafsi imepokelewa kutoka ${sender}: ${text}`);
          try {
            const completion = await groq.chat.completions.create({
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: text }
              ],
              model: 'llama-3.1-8b-instant',
              temperature: 0.2,
              max_tokens: 250,
            });

            const reply = completion.choices[0]?.message?.content || 'Samahani, sijapata jibu.';
            await sock.sendMessage(sender, { text: reply }, { quoted: msg });
            console.log(`Jibu limetumwa: ${reply}`);
          } catch (err) {
            console.error('Groq AI Error:', err.message);
          }
        }
      }
    });

  } catch (err) {
    console.error('Bot Error:', err.message);
  }
}

initBot();
