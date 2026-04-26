const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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

if (!TOKEN) throw new Error('Falta TOKEN en Railway');
if (!CLIENT_ID) throw new Error('Falta CLIENT_ID en Railway');

const config = {
  guildName: 'LINEA ROJA',

  encargadoDelictivoRoleId: '1495196576946327653',
  jefeDelictivoRoleId: '1497857251128508427',
  subjefeDelictivoRoleId: '1497857296259354655',

  crearOrgChannelId: '1497855498362556446',
  solicitarRolChannelId: '1497857200847065231',
  listaOrgsChannelId: '1497859602979492082',
  databaseChannelId: '1497855438832533586',
  logsChannelId: '1497859320531124234',

  logoUrl: 'https://cdn.discordapp.com/attachments/1495196888562012191/1497833637448650903/logoLNR-sinfondo.png'
};

const ORGS_FILE = path.join(__dirname, 'organizaciones.json');
const DB_FILE = path.join(__dirname, 'org_db_message.json');

function ensureFile(file, fallback) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(fallback, null, 2), 'utf8');
  }
}

function readJson(file, fallback) {
  ensureFile(file, fallback);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function readOrgs() {
  return readJson(ORGS_FILE, {});
}

function writeOrgs(data) {
  writeJson(ORGS_FILE, data);
}

function cleanKey(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatRoleName(name) {
  const clean = name.trim();
  return clean.startsWith('🔫 ~') ? clean : `🔫 ~ ${clean}`;
}

function hasRole(member, roleId) {
  return member?.roles?.cache?.has(roleId);
}

function isEncargado(member) {
  return hasRole(member, config.encargadoDelictivoRoleId);
}

function isBoss(member, org) {
  return member.id === org.jefeId || isEncargado(member);
}

function isManager(member, org) {
  return (
    isEncargado(member) ||
    member.id === org.jefeId ||
    org.subjefes.includes(member.id)
  );
}

function getOrg(name) {
  const key = cleanKey(name);
  return readOrgs()[key] || null;
}

async function logAction(guild, content) {
  const channel = await guild.channels.fetch(config.logsChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  await channel.send({ content });
}

function buildDatabaseEmbed() {
  const orgs = Object.values(readOrgs());

  const description = orgs.length
    ? orgs.map(org => [
        `**${org.nombre}**`,
        `Rol: <@&${org.roleId}>`,
        `Jefe: <@${org.jefeId}>`,
        `Subjefes: ${org.subjefes.length}`,
        `Miembros: ${org.miembros.length}/${org.slots}`
      ].join('\n')).join('\n\n')
    : 'No hay organizaciones registradas.';

  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('Base de Datos de Organizaciones')
    .setDescription(description)
    .setThumbnail(config.logoUrl);
}

async function updateDatabase() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = await guild.channels.fetch(config.databaseChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const db = readJson(DB_FILE, {});
  const embed = buildDatabaseEmbed();

  if (db.messageId) {
    const oldMsg = await channel.messages.fetch(db.messageId).catch(() => null);
    if (oldMsg) {
      await oldMsg.edit({ embeds: [embed] });
      return;
    }
  }

  const msg = await channel.send({ embeds: [embed] });
  writeJson(DB_FILE, { messageId: msg.id });
}

function buildCreatePanel() {
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('Crear Organización')
    .setDescription(
      [
        'Presiona el botón para registrar una organización.',
        '',
        '**El bot hará esto:**',
        '• Crear el rol de la organización',
        '• Dar rol al jefe',
        '• Guardar la información en base de datos',
        '',
        '**El bot NO creará canales.**'
      ].join('\n')
    )
    .setThumbnail(config.logoUrl);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('crear_org_modal')
      .setLabel('Crear organización')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

function buildCreateModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_crear_org')
    .setTitle('Crear Organización');

  const nombre = new TextInputBuilder()
    .setCustomId('nombre')
    .setLabel('Nombre de la organización')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const rol = new TextInputBuilder()
    .setCustomId('rol')
    .setLabel('Nombre del rol')
    .setPlaceholder('Ej: Jota')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const color = new TextInputBuilder()
    .setCustomId('color')
    .setLabel('Color HEX')
    .setPlaceholder('#ff0000')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const slots = new TextInputBuilder()
    .setCustomId('slots')
    .setLabel('Slots')
    .setPlaceholder('Ej: 14')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const jefe = new TextInputBuilder()
    .setCustomId('jefe')
    .setLabel('ID del jefe')
    .setPlaceholder('Ej: 123456789012345678')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nombre),
    new ActionRowBuilder().addComponents(rol),
    new ActionRowBuilder().addComponents(color),
    new ActionRowBuilder().addComponents(slots),
    new ActionRowBuilder().addComponents(jefe)
  );

  return modal;
}

function buildListEmbed(org) {
  const miembros = org.miembros.length
    ? org.miembros.map((id, i) => `${i + 1}. <@${id}>`).join('\n')
    : 'Sin miembros registrados.';

  const subjefes = org.subjefes.length
    ? org.subjefes.map(id => `<@${id}>`).join('\n')
    : 'Sin subjefes.';

  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle(`Lista de ${org.nombre}`)
    .setDescription(
      [
        `**Rol:** <@&${org.roleId}>`,
        `**Jefe:** <@${org.jefeId}>`,
        '',
        '**Subjefes:**',
        subjefes,
        '',
        `**Miembros:** ${org.miembros.length}/${org.slots}`,
        miembros
      ].join('\n')
    )
    .setThumbnail(config.logoUrl)
    .setFooter({ text: `${config.guildName} • Organizaciones` });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Channel]
});

const commands = [
  new SlashCommandBuilder()
    .setName('setuporgs')
    .setDescription('Enviar panel para crear organizaciones')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('addmiembro')
    .setDescription('Agregar miembro a una organización')
    .addStringOption(o => o.setName('org').setDescription('Nombre de la org').setRequired(true))
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('removemiembro')
    .setDescription('Quitar miembro de una organización')
    .addStringOption(o => o.setName('org').setDescription('Nombre de la org').setRequired(true))
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('listamiembros')
    .setDescription('Mandar lista pública de una organización')
    .addStringOption(o => o.setName('org').setDescription('Nombre de la org').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('setsubjefe')
    .setDescription('Poner subjefe en una organización')
    .addStringOption(o => o.setName('org').setDescription('Nombre de la org').setRequired(true))
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('removesubjefe')
    .setDescription('Quitar subjefe de una organización')
    .addStringOption(o => o.setName('org').setDescription('Nombre de la org').setRequired(true))
    .addUserOption(o => o.setName('usuario').setDescription('Usuario').setRequired(true))
    .toJSON()
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log('Comandos registrados correctamente.');
}

client.once('clientReady', async () => {
  console.log(`Bot organizaciones conectado como ${client.user.tag}`);
  ensureFile(ORGS_FILE, {});
  ensureFile(DB_FILE, {});
  await registerCommands();
  await updateDatabase();
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setuporgs') {
        const channel = await interaction.guild.channels.fetch(config.crearOrgChannelId).catch(() => null);
        if (!channel?.isTextBased()) {
          return interaction.reply({ content: 'No encontré el canal de crear orgs.', ephemeral: true });
        }

        await channel.send(buildCreatePanel());
        return interaction.reply({ content: 'Panel enviado.', ephemeral: true });
      }

      if (interaction.commandName === 'addmiembro') {
        if (interaction.channelId !== config.solicitarRolChannelId) {
          return interaction.reply({ content: `Usa este comando en <#${config.solicitarRolChannelId}>.`, ephemeral: true });
        }

        const org = getOrg(interaction.options.getString('org'));
        const user = interaction.options.getUser('usuario');

        if (!org) return interaction.reply({ content: 'No encontré esa organización.', ephemeral: true });
        if (!isManager(interaction.member, org)) return interaction.reply({ content: 'No tienes permiso.', ephemeral: true });
        if (org.miembros.includes(user.id)) return interaction.reply({ content: 'Ese usuario ya está en la organización.', ephemeral: true });
        if (org.miembros.length >= org.slots) return interaction.reply({ content: 'La organización no tiene slots.', ephemeral: true });

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: 'No encontré al usuario.', ephemeral: true });

        await member.roles.add(org.roleId);

        const orgs = readOrgs();
        org.miembros.push(user.id);
        orgs[org.key] = org;
        writeOrgs(orgs);

        await updateDatabase();
        await logAction(interaction.guild, `<@${interaction.user.id}> agregó a <@${user.id}> a **${org.nombre}**.`);

        return interaction.reply({ content: `${user} fue agregado a **${org.nombre}**.` });
      }

      if (interaction.commandName === 'removemiembro') {
        if (interaction.channelId !== config.solicitarRolChannelId) {
          return interaction.reply({ content: `Usa este comando en <#${config.solicitarRolChannelId}>.`, ephemeral: true });
        }

        const org = getOrg(interaction.options.getString('org'));
        const user = interaction.options.getUser('usuario');

        if (!org) return interaction.reply({ content: 'No encontré esa organización.', ephemeral: true });
        if (!isManager(interaction.member, org)) return interaction.reply({ content: 'No tienes permiso.', ephemeral: true });

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (member) {
          await member.roles.remove(org.roleId).catch(() => null);
          await member.roles.remove(config.subjefeDelictivoRoleId).catch(() => null);
        }

        const orgs = readOrgs();
        org.miembros = org.miembros.filter(id => id !== user.id);
        org.subjefes = org.subjefes.filter(id => id !== user.id);
        orgs[org.key] = org;
        writeOrgs(orgs);

        await updateDatabase();
        await logAction(interaction.guild, `<@${interaction.user.id}> removió a <@${user.id}> de **${org.nombre}**.`);

        return interaction.reply({ content: `${user} fue removido de **${org.nombre}**.` });
      }

      if (interaction.commandName === 'listamiembros') {
        if (interaction.channelId !== config.listaOrgsChannelId) {
          return interaction.reply({ content: `Usa este comando en <#${config.listaOrgsChannelId}>.`, ephemeral: true });
        }

        const org = getOrg(interaction.options.getString('org'));

        if (!org) return interaction.reply({ content: 'No encontré esa organización.', ephemeral: true });
        if (!isManager(interaction.member, org)) return interaction.reply({ content: 'No tienes permiso.', ephemeral: true });

        return interaction.reply({ embeds: [buildListEmbed(org)] });
      }

      if (interaction.commandName === 'setsubjefe') {
        if (interaction.channelId !== config.solicitarRolChannelId) {
          return interaction.reply({ content: `Usa este comando en <#${config.solicitarRolChannelId}>.`, ephemeral: true });
        }

        const org = getOrg(interaction.options.getString('org'));
        const user = interaction.options.getUser('usuario');

        if (!org) return interaction.reply({ content: 'No encontré esa organización.', ephemeral: true });
        if (!isBoss(interaction.member, org)) return interaction.reply({ content: 'Solo jefe o encargado.', ephemeral: true });
        if (!org.miembros.includes(user.id)) return interaction.reply({ content: 'Primero debe ser miembro de la organización.', ephemeral: true });

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) return interaction.reply({ content: 'No encontré al usuario.', ephemeral: true });

        await member.roles.add(config.subjefeDelictivoRoleId);

        const orgs = readOrgs();
        if (!org.subjefes.includes(user.id)) org.subjefes.push(user.id);
        orgs[org.key] = org;
        writeOrgs(orgs);

        await updateDatabase();
        await logAction(interaction.guild, `<@${interaction.user.id}> puso a <@${user.id}> como subjefe de **${org.nombre}**.`);

        return interaction.reply({ content: `${user} ahora es subjefe de **${org.nombre}**.` });
      }

      if (interaction.commandName === 'removesubjefe') {
        if (interaction.channelId !== config.solicitarRolChannelId) {
          return interaction.reply({ content: `Usa este comando en <#${config.solicitarRolChannelId}>.`, ephemeral: true });
        }

        const org = getOrg(interaction.options.getString('org'));
        const user = interaction.options.getUser('usuario');

        if (!org) return interaction.reply({ content: 'No encontré esa organización.', ephemeral: true });
        if (!isBoss(interaction.member, org)) return interaction.reply({ content: 'Solo jefe o encargado.', ephemeral: true });

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (member) await member.roles.remove(config.subjefeDelictivoRoleId).catch(() => null);

        const orgs = readOrgs();
        org.subjefes = org.subjefes.filter(id => id !== user.id);
        orgs[org.key] = org;
        writeOrgs(orgs);

        await updateDatabase();
        await logAction(interaction.guild, `<@${interaction.user.id}> quitó a <@${user.id}> como subjefe de **${org.nombre}**.`);

        return interaction.reply({ content: `${user} ya no es subjefe de **${org.nombre}**.` });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'crear_org_modal') {
        if (!isEncargado(interaction.member)) {
          return interaction.reply({ content: 'No tienes permiso.', ephemeral: true });
        }

        return interaction.showModal(buildCreateModal());
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_crear_org') {
        if (!isEncargado(interaction.member)) {
          return interaction.reply({ content: 'No tienes permiso.', ephemeral: true });
        }

        const nombre = interaction.fields.getTextInputValue('nombre').trim();
        const rolNombre = formatRoleName(interaction.fields.getTextInputValue('rol').trim());
        const color = interaction.fields.getTextInputValue('color').trim();
        const slots = Number(interaction.fields.getTextInputValue('slots').trim());
        const jefeId = interaction.fields.getTextInputValue('jefe').trim();

        const key = cleanKey(nombre);

        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
          return interaction.reply({ content: 'Color inválido. Usa formato #ff0000.', ephemeral: true });
        }

        if (!Number.isInteger(slots) || slots <= 0) {
          return interaction.reply({ content: 'Slots inválidos.', ephemeral: true });
        }

        const jefeMember = await interaction.guild.members.fetch(jefeId).catch(() => null);
        if (!jefeMember) return interaction.reply({ content: 'No encontré al jefe.', ephemeral: true });

        const orgs = readOrgs();
        if (orgs[key]) return interaction.reply({ content: 'Esa organización ya existe.', ephemeral: true });

        await interaction.reply({ content: 'Creando organización...', ephemeral: true });

        const role = await interaction.guild.roles.create({
          name: rolNombre,
          color,
          reason: `Organización creada por ${interaction.user.tag}`
        });

        await jefeMember.roles.add(role.id);
        await jefeMember.roles.add(config.jefeDelictivoRoleId);

        orgs[key] = {
          key,
          nombre,
          roleId: role.id,
          jefeId,
          subjefes: [],
          miembros: [jefeId],
          slots,
          createdBy: interaction.user.id,
          createdAt: Date.now()
        };

        writeOrgs(orgs);
        await updateDatabase();
        await logAction(interaction.guild, `<@${interaction.user.id}> creó la organización **${nombre}** con rol <@&${role.id}> y jefe <@${jefeId}>.`);

        return interaction.editReply({
          content: `Organización **${nombre}** creada correctamente con rol <@&${role.id}>.`
        });
      }
    }
  } catch (error) {
    console.error(error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Ocurrió un error.',
        ephemeral: true
      }).catch(() => null);
    }
  }
});

client.login(TOKEN);
