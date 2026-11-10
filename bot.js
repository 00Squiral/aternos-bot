const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');

// CONFIGURATION
const MC_IP = "excursionServer.aternos.me"; // Your Aternos Server IP
const JOIN_LINK = "https://add.aternos.org/excursionServer";
const CHECK_INTERVAL_MS = 60000; // Check background status every 60s

let lastStatus = null; // Caches state to prevent spamming

async function fetchServerStatus() {
    try {
        const response = await fetch(`https://api.mcstatus.io/v2/status/java/${MC_IP}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (err) {
        console.error("Status check failed:", err);
        return null;
    }
}

function formatStatusMessage(data) {
    if (!data || !data.online) {
        return `❌ *Aternos Server Status*\n\n🔴 *Status:* Offline\n🔗 *Join Server:* ${JOIN_LINK}`;
    }
    return `🎮 *Aternos Server Status*\n\n🟢 *Status:* Online\n👥 *Players:* ${data.players.online}/${data.players.max}\n🔗 *Join Server:* ${JOIN_LINK}`;
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('Bot successfully connected to WhatsApp!');
        }
    });

    // 1. RESPOND ONLY WHEN ASKED (!status or !mc)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim().toLowerCase();
        const sender = msg.key.remoteJid;

        if (text === '!status' || text === '!mc') {
            const statusData = await fetchServerStatus();
            const replyText = formatStatusMessage(statusData);
            await sock.sendMessage(sender, { text: replyText }, { quoted: msg });
        }
    });
}

startBot();
