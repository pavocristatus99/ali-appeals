import fetch from 'node-fetch';
import { API_ENDPOINT, MAX_EMBED_FIELD_CHARS, MAX_EMBED_FOOTER_CHARS } from "./helpers/discord-helpers.js";
import { createJwt, decodeJwt } from "./helpers/jwt-helpers.js";
import { getBan, isBlocked } from "./helpers/user-helpers.js";

export async function handler(event, context, interaction) {
    let payload;
    if (process.env.USE_NETLIFY_FORMS) {
        payload = JSON.parse(event.body).payload.data;
    } else {
        if (event.httpMethod !== "POST") {
            return {
                statusCode: 405
            };
        }

        const params = new URLSearchParams(event.body);
        payload = {
            banReason: params.get("banReason") || undefined,
            appealText: params.get("appealText") || undefined,
            futureActions: params.get("futureActions") || undefined,
            token: params.get("token") || undefined
        };
    }

    if (payload.banReason !== undefined &&
        payload.appealText !== undefined &&
        payload.futureActions !== undefined && 
        payload.token !== undefined) {
        
        const userInfo = decodeJwt(payload.token);
        if (isBlocked(userInfo.id)) {
            return {
                statusCode: 303,
                headers: {
                    "Location": `/error?msg=${encodeURIComponent("Anda tidak dapat mengajukan ban appeal dengan akun ini.")}`,
                },
            };
        }
        
        const message = {
            embed: {
                title: "Permintaan Unban Baru !",
                timestamp: new Date().toISOString(),
                fields: [
                    {
                        name: "Submitter",
                        value: `<@${userInfo.id}> (${userInfo.username}#${userInfo.discriminator})`
                    },
                    {
                        name: "Kenapa anda diban ?",
                        value: payload.banReason.slice(0, MAX_EMBED_FIELD_CHARS)
                    },
                    {
                        name: "Mengapa Anda merasa Anda harus di unban ?",
                        value: payload.appealText.slice(0, MAX_EMBED_FIELD_CHARS)
                    },
                    {
                        name: "Apa yang akan Anda lakukan untuk tidak diban di kemudian hari ?",
                        value: payload.futureActions.slice(0, MAX_EMBED_FIELD_CHARS)
                    }
                ]
            }
        }

        if (process.env.GUILD_ID) {
            try {
                const ban = await getBan(userInfo.id, process.env.GUILD_ID, process.env.DISCORD_BOT_TOKEN);
                if (ban !== null && ban.reason) {
                    message.embed.footer = {
                        text: `Ban reason: ${ban.reason}`.slice(0, MAX_EMBED_FOOTER_CHARS)
                    };
                }
            } catch (e) {
                console.log(e);
            }

            if (!process.env.DISABLE_UNBAN_LINK) {
                const unbanUrl = new URL("/.netlify/functions/unban", DEPLOY_PRIME_URL);
                const unbanInfo = {
                    userId: userInfo.id
                };
    
                message.components = [{
                    type: 1,
                    components: [{
                        type: 2,
                        style: 5,
                        label: "Unban member",
                        custom_id: "unban_button" // Menambahkan custom_id ke tombol unban
                    }]
                }];
            }
        }

        const result = await fetch(`${API_ENDPOINT}/channels/${encodeURIComponent(process.env.APPEALS_CHANNEL)}/messages`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`
            },
            body: JSON.stringify(message)
        });

        if (result.ok) {
            const { id: messageId } = await result.json(); // Simpan ID pesan dalam variabel messageId
            if (process.env.USE_NETLIFY_FORMS) {
                if (interaction.isButton() && interaction.customId === "unban_button") {
                    const channel = interaction.channel;
                    const message = await channel.messages.fetch(messageId); // Mengambil pesan dengan ID yang disimpan sebelumnya
            
                    // Memperbarui embed dengan informasi bahwa anggota telah diunban
                    const embed = message.embeds[0]; // Mengambil embed pertama dari pesan
                    embed.description = "Member telah diunban oleh " + interaction.user.username;
            
                    // Mengirimkan pesan yang sudah diperbarui
                    await message.edit({ embeds: [embed] });
                }
                return {
                    statusCode: 200
                };
            } else {
                return {
                    statusCode: 303,
                    headers: {
                        "Location": "/success"
                    }
                };
            }
        } else {
            console.log(JSON.stringify(await result.json()));
            throw new Error("Failed to submit message");
        }
        
    }

    return {
        statusCode: 400
    };
}
