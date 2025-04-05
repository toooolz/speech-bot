const { message } = require("telegraf/filters")
const { Telegraf } = require('telegraf')
require('dotenv').config()
const { voiceHandler } = require('./lib')


const bot = new Telegraf(process.env.BOT_TOKEN)


bot.on(message('voice'), async (ctx) => {
  voiceHandler(ctx, bot);
});

bot.command('ErroTest', () => {
  throw new Error('Error test')
});

// bot.on(message('document'), documentHandler);
// bot.on(message("photo"), photoHandler)
// bot.on(message('text'), linkHandler)
// bot.command('gen', genImageCmd)
// bot.start(startHandler);

bot.launch()

// Gracefully stop bot on SIGINT, SIGTERM
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

