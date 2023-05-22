import { decodeJwt } from "./helpers/jwt-helpers.js";
import { unbanUser } from "./helpers/user-helpers.js";
import { sendMessageToUser } from "./helpers/discord-helpers.js"; // Misalkan ada modul helper untuk mengirim pesan Discord

export async function handler(event, context) {
    if (event.httpMethod !== "GET") {
        return {
            statusCode: 405
        };
    }

    if (event.queryStringParameters.token !== undefined) {
        const unbanInfo = decodeJwt(event.queryStringParameters.token);
        if (unbanInfo.userId !== undefined) {
            try {
                await unbanUser(unbanInfo.userId, process.env.GUILD_ID, process.env.DISCORD_BOT_TOKEN);

                // Kirim pesan ke member yang berhasil diunban
                await sendMessageToUser(unbanInfo.userId, "Anda telah berhasil diunban!");

                return {
                    statusCode: 303,
                    headers: {
                        "Location": `/success?msg=${encodeURIComponent("User has been unbanned\nPlease contact them and let them know")}`
                    }
                };
            } catch (e) {
                return {
                    statusCode: 303,
                    headers: {
                        "Location": `/error?msg=${encodeURIComponent("Failed to unban user\nPlease manually unban")}`
                    }
                };
            }
        }
    }

    return {
        statusCode: 400
    };
}
