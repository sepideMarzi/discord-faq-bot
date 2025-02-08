require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const fs = require("fs");

// ✅ Bot Configuration
const APPLICATION_ID = "1335748275285921892";
const SERVER_ID = "1128749589231579187";
const TOKEN = process.env.DISCORD_TOKEN;
const ADMIN_ROLE_ID = "1311001353916780555"; // ✅ Admin Role ID

// ✅ Load FAQ Questions from JSON File
const QUESTIONS_FILE = "questions.json";
const questionsData = JSON.parse(fs.readFileSync(QUESTIONS_FILE, "utf8"));

// ✅ Register Slash Commands
const commands = [
  new SlashCommandBuilder()
    .setName("faq")
    .setDescription("Browse FAQs by category")
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationGuildCommands(APPLICATION_ID, SERVER_ID), { body: commands });
    console.log("✅ Slash commands registered!");
  } catch (error) {
    console.error("❌ Failed to register commands:", error);
  }
})();

// ✅ Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// ✅ Handle Slash Command Interaction
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "faq") {
    await interaction.reply({
      content: "**📚 Select a category to view questions:**",
      components: generateCategoryButtons()
    });
  } 
  
  // ✅ Handle Button Click Interactions
  else if (interaction.isButton()) {
    const [action, categoryOrQuestion] = interaction.customId.split("_");

    if (action === "category") {
      await interaction.update({
        content: `📂 **Category: ${categoryOrQuestion}**\nSelect a question below:`,
        components: generateQuestionButtons(categoryOrQuestion)
      });
    }

    if (action === "question") {
      const answer = getAnswer(categoryOrQuestion);
      const feedbackRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`feedback_yes_${interaction.id}`)
            .setLabel("✅ Yes, it helped (Close)")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`feedback_no_${categoryOrQuestion}`)
            .setLabel("❌ No, I need more help")
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.update({
        content: `📌 **Q:** ${categoryOrQuestion}\n✅ **A:** ${answer}`,
        components: [feedbackRow]
      });
    }

    // ✅ Handle Feedback Buttons
    if (action === "feedback") {
      const question = categoryOrQuestion;
      const adminRoleMention = `<@&${ADMIN_ROLE_ID}>`;

      if (categoryOrQuestion.startsWith("yes")) {
        // ✅ Delete the message if the user selects "Yes, it helped"
        await interaction.message.delete().catch(console.error);
        return;
      }

      // ✅ Notify Admins with Correct Question
      const helpEmbed = new EmbedBuilder()
        .setColor(0xff0000) // 🔴 Red Alert
        .setTitle("⚠️ Assistance Needed!")
        .setDescription("A user needs further assistance with an FAQ.")
        .addFields(
          { name: "📌 Question", value: question, inline: false },
          { name: "👤 User", value: `<@${interaction.user.id}>`, inline: false }
        )
        .setTimestamp();

      const dismissRow = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`dismiss_${interaction.id}`)
            .setLabel("Dismiss Message")
            .setStyle(ButtonStyle.Secondary)
        );

      const helpMessage = await interaction.channel.send({
        content: `${adminRoleMention}`,
        embeds: [helpEmbed],
        components: [dismissRow]
      });

      // ✅ Notify user that an admin is coming
      await interaction.reply({
        content: `❌ No problem! An admin will assist you shortly. Please wait for help.`,
        ephemeral: true
      });

      // ✅ Handle Dismiss Button
      client.on("interactionCreate", async (dismissInteraction) => {
        if (
          dismissInteraction.isButton() &&
          dismissInteraction.customId === `dismiss_${interaction.id}`
        ) {
          await helpMessage.delete();
          await dismissInteraction.reply({
            content: "🗑️ The message has been dismissed.",
            ephemeral: true
          });
        }
      });
    }
  }
});

// ✅ Generate Category Buttons
function generateCategoryButtons() {
  const categories = Object.keys(questionsData);
  const row = new ActionRowBuilder();
  categories.forEach((category) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`category_${category}`)
        .setLabel(category)
        .setStyle(ButtonStyle.Primary)
    );
  });
  return [row];
}

// ✅ Generate Question Buttons for a Category
function generateQuestionButtons(category) {
  const questions = Object.keys(questionsData[category] || {});
  const rows = [];
  let row = new ActionRowBuilder();

  questions.forEach((question, index) => {
    if (index % 5 === 0 && index !== 0) { // Discord allows a max of 5 buttons per row
      rows.push(row);
      row = new ActionRowBuilder();
    }
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`question_${question}`)
        .setLabel(question.substring(0, 80)) // Ensure label fits within Discord limit
        .setStyle(ButtonStyle.Secondary)
    );
  });

  rows.push(row); // Add the last row
  return rows;
}

// ✅ Get Answer for a Question
function getAnswer(question) {
  for (const category in questionsData) {
    if (questionsData[category][question]) {
      return questionsData[category][question];
    }
  }
  return "No answer found.";
}

// ✅ On Ready
client.once("ready", () => {
  console.log(`✅ ${client.user.tag} is online and ready!`);
});

// ✅ Log In to Discord
client.login(TOKEN);
