const { App } = require("@slack/bolt");
require("dotenv").config();
const cron = require("node-cron");
const fs = require("fs");
const { parse } = require("csv-parse");

// Config
const PORT = process.env.PORT || 3000;
const excludedChannelNames = ["random", "general"];

// Load message list
const cleanedMessages = [];
fs.createReadStream("./assets/messages.csv")
  .pipe(parse({ delimiter: "," }))
  .on("data", record => {
    const cleanedRecord = record.filter(entry => entry.trim() !== "");
    if (cleanedRecord.length > 0) {
      cleanedMessages.push(...cleanedRecord);
    }
  })
  .on("end", function () {
    console.log("Message list loaded successfully!");
  })
  .on("error", function (error) {
    console.error(error.message);
  });

// Init
// const app = new App({
//   token: process.env.SLACK_BOT_TOKEN,
//   signingSecret: process.env.SLACK_SIGNING_SECRET,
//   port: PORT,
// });

// Init: Socket mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  // Socket Mode doesn't listen on a port, but in case you want your app to respond to OAuth,
  // you still need to listen on some port!
  port: PORT,
});

app.event("channel_created", async ({ event, client, say }) => {
  if (event.channel.name.match(/^bot/)) {
    try {
      const channelId = event.channel.id;

      await client.conversations.join({
        channel: channelId,
      });

      say(
        `:wave: Hello! I'm a bot, and I'm here at ${event.channel.name} to hang out.`
      );
    } catch (error) {
      console.error(`Error inviting bot to channel: ${error}`);
    }
  }
});

cron.schedule("0 15 * * Friday", async () => {
  try {
    const result = await app.client.conversations.list({
      token: process.env.SLACK_BOT_TOKEN,
      types: "public_channel",
    });

    for (const channel of result.channels) {
      if (excludedChannelNames.includes(channel.name)) {
        continue;
      }

      try {
        const members = await app.client.conversations.members({
          token: process.env.SLACK_BOT_TOKEN,
          channel: channel.id,
        });

        if (members.members.includes(process.env.SLACK_BOT_USER_ID)) {
          const messageIdx = Math.floor(Math.random() * cleanedMessages.length);
          const message = cleanedMessages[messageIdx];

          await app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: channel.id,
            text: message,
          });
        }
      } catch (error) {
        console.error(
          `Error getting members of channel ${channel.name}: ${error}`
        );
      }
    }
  } catch (error) {
    console.error(`Error sending message to channel: ${error}`);
  }
});

(async () => {
  // Start your app
  await app.start();

  console.log(`⚡️ Bolt app is running on port ${PORT}!`);
})();
