const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = '1188377448346288158';

if (!TOKEN) throw new Error('Falta TOKEN');
if (!CLIENT_ID) throw new Error('Falta CLIENT_ID');

const config = {
  encargado: '1495196576946327653',
  jefe: '1497857251128508427',
  subjefe: '1497857296259354655',

  canalSolicitar: '1497857200847065231',
  canalLista: '1497859602979492082',

  canalLogs: '1497859320531124234',
  canalDB: '1497855438832533586',

  logo: 'https://cdn.discordapp.com/attachments/1495196888562012191/1497833637448650903/logoLNR-sinfondo.png'
};

const FILE = path.join(__dirname, 'orgs.json');

function read() {
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '{}');
  return JSON.parse(fs.readFileSync(FILE));
}

function write(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function isManager(member, org) {
  return (
    member.roles.cache.has(config.encargado) ||
    member.id === org.jefe ||
    org.subjefes.includes(member.id)
  );
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel]
});

const commands = [
  new SlashCommandBuilder()
    .setName('crearorg')
    .setDescription('Crear organización')
    .addStringOption(o => o.setName('nombre').setRequired(true))
    .addUserOption(o => o.setName('jefe').setRequired(true))
    .addIntegerOption(o => o.setName('slots').setRequired(true)),

  new SlashCommandBuilder()
    .setName('addmiembro')
    .setDescription('Agregar miembro')
    .addStringOption(o => o.setName('org').setRequired(true))
    .addUserOption(o => o.setName('usuario').setRequired(true)),

  new SlashCommandBuilder()
    .setName('removemiembro')
    .setDescription('Quitar miembro')
    .addStringOption(o => o.setName('org').setRequired(true))
    .addUserOption(o => o.setName('usuario').setRequired(true)),

  new SlashCommandBuilder()
    .setName('listamiembros')
    .setDescription('Lista de miembros')
    .addStringOption(o => o.setName('org').setRequired(true)),

  new SlashCommandBuilder()
    .setName('setsubjefe')
    .setDescription('Poner subjefe')
    .addStringOption(o => o.setName('org').setRequired(true))
    .addUserOption(o => o.setName('usuario').setRequired(true)),

  new SlashCommandBuilder()
    .setName('removesubjefe')
    .setDescription('Quitar subjefe')
    .addStringOption(o => o.setName('org').setRequired(true))
    .addUserOption(o => o.setName('usuario').setRequired(true))
];

async function register() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands.map(c => c.toJSON())
  });
}

client.once('ready', async () => {
  console.log(`Org bot listo: ${client.user.tag}`);
  await register();
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  const db = read();

  if (i.commandName === 'crearorg') {
    if (!i.member.roles.cache.has(config.encargado)) {
      return i.reply({ content: 'Sin permisos', ephemeral: true });
    }

    const nombre = i.options.getString('nombre');
    const jefe = i.options.getUser('jefe');
    const slots = i.options.getInteger('slots');

    if (db[nombre]) return i.reply('Ya existe');

    const role = await i.guild.roles.create({
      name: `🔫 ~ ${nombre}`,
      reason: 'Nueva org'
    });

    const jefeMember = await i.guild.members.fetch(jefe.id);
    await jefeMember.roles.add(role);
    await jefeMember.roles.add(config.jefe);

    db[nombre] = {
      role: role.id,
      jefe: jefe.id,
      subjefes: [],
      miembros: [jefe.id],
      slots
    };

    write(db);

    return i.reply(`Organización creada: 🔫 ~ ${nombre}`);
  }

  if (i.commandName === 'addmiembro') {
    if (i.channelId !== config.canalSolicitar)
      return i.reply({ content: 'Usa canal correcto', ephemeral: true });

    const org = db[i.options.getString('org')];
    if (!org) return i.reply('No existe');

    if (!isManager(i.member, org))
      return i.reply({ content: 'Sin permisos', ephemeral: true });

    const user = i.options.getUser('usuario');
    const member = await i.guild.members.fetch(user.id);

    await member.roles.add(org.role);
    org.miembros.push(user.id);

    write(db);

    return i.reply(`${user} agregado`);
  }

  if (i.commandName === 'removemiembro') {
    if (i.channelId !== config.canalSolicitar)
      return i.reply({ content: 'Usa canal correcto', ephemeral: true });

    const org = db[i.options.getString('org')];
    if (!org) return i.reply('No existe');

    if (!isManager(i.member, org))
      return i.reply({ content: 'Sin permisos', ephemeral: true });

    const user = i.options.getUser('usuario');
    const member = await i.guild.members.fetch(user.id);

    await member.roles.remove(org.role);

    org.miembros = org.miembros.filter(x => x !== user.id);
    write(db);

    return i.reply(`${user} removido`);
  }

  if (i.commandName === 'listamiembros') {
    if (i.channelId !== config.canalLista)
      return i.reply({ content: 'Usa canal correcto', ephemeral: true });

    const org = db[i.options.getString('org')];
    if (!org) return i.reply('No existe');

    if (!isManager(i.member, org))
      return i.reply({ content: 'Sin permisos', ephemeral: true });

    const lista = org.miembros.map(id => `<@${id}>`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`Lista ${i.options.getString('org')}`)
      .setDescription(lista || 'Sin miembros')
      .setColor('Red');

    return i.reply({ embeds: [embed] });
  }

  if (i.commandName === 'setsubjefe') {
    const org = db[i.options.getString('org')];
    const user = i.options.getUser('usuario');

    if (!org) return i.reply('No existe');

    if (i.member.id !== org.jefe)
      return i.reply({ content: 'Solo jefe', ephemeral: true });

    org.subjefes.push(user.id);

    const member = await i.guild.members.fetch(user.id);
    await member.roles.add(config.subjefe);

    write(db);

    return i.reply(`${user} ahora es subjefe`);
  }

  if (i.commandName === 'removesubjefe') {
    const org = db[i.options.getString('org')];
    const user = i.options.getUser('usuario');

    if (!org) return i.reply('No existe');

    if (i.member.id !== org.jefe)
      return i.reply({ content: 'Solo jefe', ephemeral: true });

    org.subjefes = org.subjefes.filter(x => x !== user.id);

    const member = await i.guild.members.fetch(user.id);
    await member.roles.remove(config.subjefe);

    write(db);

    return i.reply(`${user} ya no es subjefe`);
  }
});

client.login(TOKEN);
