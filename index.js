// index.js
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const safe = (val, fallback = null) => (val === undefined || val === null ? fallback : val);

const client = new Client({
	authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
	puppeteer: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
});

client.on("qr", (qr) => {
	console.clear();
	console.log("Scan QR berikut untuk login WhatsApp:");
	qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
	console.log("[READY] Bot sudah siap menerima pesan.");
});

client.on("message", async (msg) => {
	try {
		const contact = await msg.getContact();
		const number = safe(contact.number, null);

		// === HANDLE STIKER ===
		if (msg.type === "sticker") {
			console.log(`[STICKER] Dapat stiker dari ${number}`);

			// ambil semua file di folder stiker/
			const stickerDir = path.join(__dirname, "stiker");
			const files = fs
				.readdirSync(stickerDir)
				.filter((f) => f.toLowerCase().endsWith(".png") || f.toLowerCase().endsWith(".jpg") || f.toLowerCase().endsWith(".jpeg") || f.toLowerCase().endsWith(".webp"));

			if (files.length === 0) {
				await msg.reply("⚠️ Tidak ada file stiker di folder `stiker/`.");
				return;
			}

			// pilih random
			const randomFile = files[Math.floor(Math.random() * files.length)];
			const filePath = path.join(stickerDir, randomFile);

			// buat MessageMedia
			const media = MessageMedia.fromFilePath(filePath);

			// kirim sebagai stiker
			await msg.reply(media, undefined, { sendMediaAsSticker: true });
			console.log(`[REPLY] Kirim stiker random (${randomFile}) ke ${number}`);
			return;
		}

		// === HANDLE TEKS ===
		if (msg.type === "chat") {
			const body = safe(msg.body, "");
			console.log(`[MESSAGE] ${number} => ${body}`);

			try {
				const resp = await axios.post("https://anggaphtml.pythonanywhere.com/chat", {
					user: number,
					text: body,
				});

				const replyText = resp.data.response || null;

				if (replyText) {
					await msg.reply(replyText);
					console.log(`[REPLY] Balasan ke ${number}: ${replyText}`);
				} else {
					console.log('[REPLY] Tidak ada field "response" dari API.');
				}
			} catch (err) {
				console.error("[API ERROR]", err.message);

				if (err.response) {
					// Error dari server API (status 4xx / 5xx)
					console.error("[API RESPONSE ERROR]", {
						status: err.response.status,
						headers: err.response.headers,
						data: err.response.data,
					});
				} else if (err.request) {
					// Request sudah dikirim tapi tidak ada respon
					console.error("[API NO RESPONSE]", err.request);
				} else {
					// Error lain (misal setup axios salah)
					console.error("[API SETUP ERROR]", err);
				}

				await msg.reply("⚠️ Maaf, server AI sedang error.");
			}
		}
	} catch (err) {
		console.error("[MESSAGE][ERROR]", err);
	}
});

client.initialize();
