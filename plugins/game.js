const { delay } = require("@whiskeysockets/baileys");
const { cmd } = require("../command");

cmd({
  pattern: "squidgame",
  desc: "Start the Squid Game in a group",
  category: "fun",
  filename: __filename
}, async (conn, mek, m, { isAdmin, isOwner, participants, reply }) => {
  try {
    if (!m.isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmin && !isOwner) return reply("❌ Only admins can start Squid Game.");

    let groupMembers = participants.filter(p => !p.admin); // Exclude admins
    if (groupMembers.length < 5) return reply("⚠️ At least 5 non-admin members are required to play.");

    let gameCreator = "@" + m.sender.split("@")[0];

    // Game announcement
    let gameMessage = `🔴 *Squid Game: Red Light, 🟢 Green Light*\n\n🎭 *Front Man*: (${gameCreator})\n`;
    gameMessage += groupMembers.map(m => "@" + m.id.split("@")[0]).join("\n") + "\n\n";
    gameMessage += "All group members are added as players! The game starts in 50 seconds.";

    await conn.sendMessage(m.chat, { text: gameMessage, mentions: groupMembers.map(m => m.id) });

    await delay(50000); // Wait 50 seconds before starting

    // Randomly select 5 players
    let players = groupMembers.sort(() => 0.5 - Math.random()).slice(0, 5);
    let playersList = players.map((p, i) => `${i + 1}. @${p.id.split("@")[0]}`).join("\n");

    await conn.sendMessage(m.chat, {
      text: `🎮 *Selected Players:*\n${playersList}\n\n🔔 The game starts now!`,
      mentions: players.map(p => p.id)
    });

    await delay(3000);

    // Rules
    let rulesMessage = `📜 Rules of Squid Game 🦑

1️⃣ During 🟥 Red Light, anyone who sends a message will be REMOVED.

2️⃣ During 🟩 Green Light, players MUST send a message. Staying silent = ELIMINATION.

3️⃣ 🛑 The game continues until only one player remains.

🏆 Survive to the end and you WIN! 🎉`;

    await conn.sendMessage(m.chat, { text: rulesMessage });

    await delay(5000);

    let remainingPlayers = [...players];

    // Game Loop
    while (remainingPlayers.length > 1) {
      let isGreenLight = Math.random() > 0.5;
      let lightMessage = isGreenLight ? "🟩 *Green Light*" : "🟥 *Red Light*";

      await conn.sendMessage(m.chat, { text: `🔔 ${lightMessage}` });

      // Collect messages for 5 seconds
      let spokenPlayers = new Set();
      const listener = (msg) => {
        try {
          let sender = msg.messages[0].key.participant || msg.messages[0].key.remoteJid;
          if (remainingPlayers.find(p => p.id === sender)) {
            spokenPlayers.add(sender);
          }
        } catch (e) {}
      };

      conn.ev.on("messages.upsert", listener);
      await delay(5000);
      conn.ev.off("messages.upsert", listener); // remove listener after round

      let playersToKick = [];

      if (isGreenLight) {
        // Eliminate silent players
        for (let player of remainingPlayers) {
          if (!spokenPlayers.has(player.id)) playersToKick.push(player);
        }
      } else {
        // Eliminate those who talked
        for (let player of remainingPlayers) {
          if (spokenPlayers.has(player.id)) playersToKick.push(player);
        }
      }

      // Kick eliminated players
      for (let player of playersToKick) {
        await conn.groupParticipantsUpdate(m.chat, [player.id], "remove");
        let eliminationMessage = isGreenLight
          ? `❌ @${player.id.split("@")[0]} stayed silent during 🟩 Green Light and was ELIMINATED.`
          : `❌ @${player.id.split("@")[0]} talked during 🟥 Red Light and was ELIMINATED.`;

        await conn.sendMessage(m.chat, {
          text: eliminationMessage,
          mentions: [player.id]
        });
      }

      // Update remaining players
      remainingPlayers = remainingPlayers.filter(p => !playersToKick.includes(p));
    }

    // Announce winner
    if (remainingPlayers.length === 1) {
      await conn.sendMessage(m.chat, {
        text: `🏆 *Congratulations @${remainingPlayers[0].id.split("@")[0]} !*\nYou survived and WON the Squid Game! 🎉`,
        mentions: [remainingPlayers[0].id]
      });
    }

  } catch (error) {
    console.error("❌ Error in .squidgame command:", error);
    reply("❌ An error occurred while running Squid Game.");
  }
});
