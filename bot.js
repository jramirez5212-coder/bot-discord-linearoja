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

  createOrgChannelId: '1497855498362556446',
  databaseChannelId: '1497855438832533586',
  logsChannelId: '1497859320531124234',

  solicitarRangoChannelId: '1497857200847065231',
  listaChannelId: '1497859602979492082',

  logoUrl: 'https://cdn.discordapp.com/attachments/1495196888562012191/1497833637448650903/logoLNR-sinfondo.png?ex=69eef5c7&is=69eda447&hm=19c61107ebe4300a21236db3fd46dce6352f93c18911a1aa766b240d04037823&'
};

const ORGS_FILE = path.join(__dirname, 'organizaciones.json');
const DB_MESSAGE_FILE = path.join(__dirname, 'org_db_message.json');

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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

function sanitizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function cleanRoleName(name) {
  const clean = name.trim();
  if (clean.startsWith('🔫 ~')) return clean;
  return `🔫 ~ ${clean}`;
}

function hasRole(member, roleId) {
  return member?.roles?.cache?.has(roleId);
}

function isEncargado(member) {
  return hasRole(member, config.encargadoDelictivoRoleId);
}

function isOrgBoss(member, org) {
  return member.id === org.jefeId || isEncargado(member);
}

function isOrgManager(member, org) {
  return (
    member.id === org.jefeId ||
    org.subjefes.includes(member.id) ||
    isEncargado(member)
  );
}

function mustBeInChannel(interaction, channelId, channelName) {
  if (interaction.channelId !== channelId) {
    interaction.reply({
      content: `Este comando solo se puede usar en <#${channelId}>.`,
      ephemeral: true
    });
    return false;
  }
  return true;
}

async function logOrg(guild, content, embed = null) {
  const channel = await guild.channels.fetch(config.logsChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  await channel.send({
    content: content || null,
    embeds: embed ? [embed] : []
  });
}

function buildCreateOrgPanel() {
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('Sistema de Organizaciones')
    .setDescription(
      [
        'Presiona el botón de abajo para crear una nueva organización.',
        '',
        '**Información requerida:**',
        '• Nombre de la organización',
        '• Nombre del rol',
        '• Color del rol en HEX',
        '• Slots máximos',
        '• ID del jefe',
        '',
        'El rol se creará automáticamente con el formato:',
        '`🔫 ~ Nombre`'
      ].join('\n')
    )
    .setThumbnail(config.logoUrl);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('org_open_create')
      .setLabel('Crear organización')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

function buildCreateOrgModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_create_org')
    .setTitle('Crear organización');

  const nombre = new TextInputBuilder()
    .setCustomId('org_nombre')
    .setLabel('Nombre de la organización')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const rol = new TextInputBuilder()
    .setCustomId('org_rol')
    .setLabel('Nombre del rol')
    .setPlaceholder('Ej: TMA')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const color = new TextInputBuilder()
    .setCustomId('org_color')
    .setLabel('Color HEX del rol')
    .setPlaceholder('#ff0000')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const slots = new TextInputBuilder()
    .setCustomId('org_slots')
    .setLabel('Slots máximos')
    .setPlaceholder('Ej: 12')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const jefe = new TextInputBuilder()
    .setCustomId('org_jefe')
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

function buildOrgListEmbed(org) {
  const miembros = org.miembros.length
    ? org.miembros.map((id, index) => `${index + 1}. <@${id}>`).join('\n')
    : 'No hay miembros registrados.';

  const subjefes = org.subjefes.length
    ? org.subjefes.map(id => `<@${id}>`).join('\n')
    : 'No hay subjefes.';

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

function buildDatabaseEmbed() {
  const orgs = Object.values(readOrgs());

  const description = orgs.length
    ? orgs.map(org => {
        return [
          `**${org.nombre}**`,
          `Rol: <@&${org.roleId}>`,
          `Jefe: <@${org.jefeId}>`,
          `Subjefes: ${org.subjefes.length}`,
          `Slots: ${org.miembros.length}/${org.slots}`
        ].join('\n');
      }).join('\n\n')
    : 'No hay organizaciones registradas.';

  return new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('Base de Datos de Organizaciones')
    .setDescription(description)
    .setThumbnail(config.logoUrl)
    .setFooter({ text: 'Actualización automática' });
}

async function updateDatabaseChannel() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return;

  const channel = await guild.channels.fetch(config.databaseChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const data = readJson(DB_MESSAGE_FILE, {});
  const embed = buildDatabaseEmbed();

  if (data.messageId) {
    const msg = await channel.messages.fetch(data.messageId).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed] });
      return;
    }
  }

  const msg = await channel.send({ embeds: [embed] });
  writeJson(DB_MESSAGE_FILE, { messageId: msg.id });
}

async function createOrgFromModal(interaction) {
  if (!isEncargado(interaction.member)) {
    return interaction.reply({
      content: 'No tienes permiso para crear organizaciones.',
      ephemeral: true
    });
  }

  const guild = interaction.guild;

  const nombre = interaction.fields.getTextInputValue('org_nombre').trim();
  const roleNameRaw = interaction.fields.getTextInputValue('org_rol').trim();
  const roleName = cleanRoleName(roleNameRaw);
  const color = interaction.fields.getTextInputValue('org_color').trim();
  const slotsRaw = interaction.fields.getTextInputValue('org_slots').trim();
  const jefeId = interaction.fields.getTextInputValue('org_jefe').trim();

  const key = sanitizeName(nombre);
  const slots = Number(slotsRaw);

  if (!key) {
    return interaction.reply({
      content: 'El nombre de la organización no es válido.',
      ephemeral: true
    });
  }

  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return interaction.reply({
      content: 'El color debe ser HEX. Ejemplo: #ff0000',
      ephemeral: true
    });
  }

  if (!Number.isInteger(slots) || slots <= 0) {
    return interaction.reply({
      content: 'Los slots deben ser un número válido.',
      ephemeral: true
    });
  }

  const jefeMember = await guild.members.fetch(jefeId).catch(() => null);
  if (!jefeMember) {
    return interaction.reply({
      content: 'No encontré al jefe con ese ID.',
      ephemeral: true
    });
  }

  const orgs = readOrgs();

  if (orgs[key]) {
    return interaction.reply({
      content: 'Ya existe una organización con ese nombre.',
      ephemeral: true
    });
  }

  await interaction.reply({
    content: 'Creando organización...',
    ephemeral: true
  });

  const role = await guild.roles.create({
    name: roleName,
    color,
    reason: `Organización creada por ${interaction.user.tag}`
  });

  await jefeMember.roles.add(role.id).catch(() => null);
  await jefeMember.roles.add(config.jefeDelictivoRoleId).catch(() => null);

  const org = {
    key,
    nombre,
    roleName,
    roleId: role.id,
    color,
    slots,
    jefeId,
    subjefes: [],
    miembros: [jefeId],
    createdBy: interaction.user.id,
    createdAt: Date.now()
  };

  orgs[key] = org;
  writeOrgs(orgs);

  await updateDatabaseChannel();

  await logOrg(
    guild,
    null,
    new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('Organización creada')
      .addFields(
        { name: 'Organización', value: org.nombre, inline: true },
        { name: 'Rol', value: `<@&${org.roleId}>`, inline: true },
        { name: 'Jefe', value: `<@${org.jefeId}>`, inline: true },
        { name: 'Slots', value: `${org.slots}`, inline: true },
        { name: 'Creada por', value: `<@${interaction.user.id}>`, inline: true }
      )
      .setThumbnail(config.logoUrl)
  );

  return interaction.editReply({
    content: `Organización **${nombre}** creada correctamente con el rol <@&${role.id}>.`
  });
}

async function addMemberToOrg(interaction, org, user) {
  const orgs = readOrgs();

  if (org.miembros.includes(user.id)) {
    return interaction.reply({
      content: 'Ese usuario ya pertenece a esta organización.',
      ephemeral: true
    });
  }

  if (org.miembros.length >= org.slots) {
    return interaction.reply({
      content: 'La organización no tiene slots disponibles.',
      ephemeral: true
    });
  }

  const target = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!target) {
    return interaction.reply({
      content: 'No encontré al usuario en el servidor.',
      ephemeral: true
    });
  }

  await target.roles.add(org.roleId).catch(() => null);

  org.miembros.push(user.id);
  orgs[org.key] = org;
  writeOrgs(orgs);

  await updateDatabaseChannel();

  await logOrg(
    interaction.guild,
    `<@${interaction.user.id}> agregó a <@${user.id}> a **${org.nombre}**.`
  );

  return interaction.reply({
    content: `${user} fue agregado a **${org.nombre}**.`,
    ephemeral: true
  });
}

async function removeMemberFromOrg(interaction, org, user) {
  const orgs = readOrgs();

  if (!org.miembros.includes(user.id)) {
    return interaction.reply({
      content: 'Ese usuario no pertenece a esta organización.',
      ephemeral: true
    });
  }

  if (user.id === org.jefeId && !isEncargado(interaction.member)) {
    return interaction.reply({
      content: 'Solo un encargado delictivo puede remover al jefe.',
      ephemeral: true
    });
  }

  org.miembros = org.miembros.filter(id => id !== user.id);
  org.subjefes = org.subjefes.filter(id => id !== user.id);

  const target = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (target) {
    await target.roles.remove(org.roleId).catch(() => null);
    await target.roles.remove(config.subjefeDelictivoRoleId).catch(() => null);
  }

  orgs[org.key] = org;
  writeOrgs(orgs);

  await updateDatabaseChannel();

  await logOrg(
    interaction.guild,
    `<@${interaction.user.id}> removió a <@${user.id}> de **${org.nombre}**.`
  );

  return interaction.reply({
    content: `${user} fue removido de **${org.nombre}**.`,
    ephemeral: true
  });
}

function getOrgByName(name) {
  const key = sanitizeName(name);
  return readOrgs()[key] || null;
}

const commands = [
  new SlashCommandBuilder()
    .setName('setuporgs')
    .setDescription('Enviar panel de creación de organizaciones')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('listaorgs')
    .setDescription('Ver organizaciones registradas')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('orginfo')
    .setDescription('Ver información de una organización')
    .addStringOption(opt =>
      opt.setName('nombre')
        .setDescription('Nombre de la organización')
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('listamiembros')
    .setDescription('Ver lista de miembros de una organización')
    .addStringOption(opt =>
      opt.setName('org')
        .setDescription('Nombre de la organización')
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('addmiembro')
    .setDescription('Agregar miembro a una organización')
    .addStringOption(opt =>
      opt.setName('org')
        .setDescription('Nombre de la organización')
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuario')
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('removemiembro')
    .setDescription('Quitar miembro de una organización')
    .addStringOption(opt =>
      opt.setName('org')
        .setDescription('Nombre de la organización')
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuario')
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('setsubjefe')
    .setDescription('Asignar subjefe a una organización')
    .addStringOption(opt =>
      opt.setName('org')
        .setDescription('Nombre de la organización')
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuario')
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('removesubjefe')
    .setDescription('Quitar subjefe de una organización')
    .addStringOption(opt =>
      opt.setName('org')
        .setDescription('Nombre de la organización')
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Usuario')
        .setRequired(true)
    )
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
  ensureFile(DB_MESSAGE_FILE, {});
  await registerCommands();
  await updateDatabaseChannel();
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setuporgs') {
        const channel = await interaction.guild.channels.fetch(config.createOrgChannelId).catch(() => null);

        if (!channel?.isTextBased()) {
          return interaction.reply({
            content: 'No encontré el canal de crear organizaciones.',
            ephemeral: true
          });
        }

        await channel.send(buildCreateOrgPanel());

        return interaction.reply({
          content: 'Panel de organizaciones enviado.',
          ephemeral: true
        });
      }

      if (interaction.commandName === 'listaorgs') {
        const orgs = Object.values(readOrgs());

        const description = orgs.length
          ? orgs.map(org => `**${org.nombre}** — <@${org.jefeId}> — ${org.miembros.length}/${org.slots}`).join('\n')
          : 'No hay organizaciones registradas.';

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('Organizaciones registradas')
              .setDescription(description)
              .setThumbnail(config.logoUrl)
          ],
          ephemeral: true
        });
      }

      if (interaction.commandName === 'orginfo') {
        const org = getOrgByName(interaction.options.getString('nombre'));

        if (!org) {
          return interaction.reply({
            content: 'No encontré esa organización.',
            ephemeral: true
          });
        }

        return interaction.reply({
          embeds: [buildOrgListEmbed(org)],
          ephemeral: true
        });
      }

      if (interaction.commandName === 'listamiembros') {
        if (!mustBeInChannel(interaction, config.listaChannelId, 'lista')) return;

        const org = getOrgByName(interaction.options.getString('org'));

        if (!org) {
          return interaction.reply({
            content: 'No encontré esa organización.',
            ephemeral: true
          });
        }

        if (!isOrgManager(interaction.member, org)) {
          return interaction.reply({
            content: 'Solo jefe, subjefe o encargado puede ver la lista.',
            ephemeral: true
          });
        }

        return interaction.reply({
          embeds: [buildOrgListEmbed(org)]
        });
      }

      if (interaction.commandName === 'addmiembro') {
        if (!mustBeInChannel(interaction, config.solicitarRangoChannelId, 'solicitar rango')) return;

        const org = getOrgByName(interaction.options.getString('org'));
        const user = interaction.options.getUser('usuario');

        if (!org) {
          return interaction.reply({
            content: 'No encontré esa organización.',
            ephemeral: true
          });
        }

        if (!isOrgManager(interaction.member, org)) {
          return interaction.reply({
            content: 'Solo jefe, subjefe o encargado puede agregar miembros.',
            ephemeral: true
          });
        }

        return addMemberToOrg(interaction, org, user);
      }

      if (interaction.commandName === 'removemiembro') {
        if (!mustBeInChannel(interaction, config.solicitarRangoChannelId, 'solicitar rango')) return;

        const org = getOrgByName(interaction.options.getString('org'));
        const user = interaction.options.getUser('usuario');

        if (!org) {
          return interaction.reply({
            content: 'No encontré esa organización.',
            ephemeral: true
          });
        }

        if (!isOrgManager(interaction.member, org)) {
          return interaction.reply({
            content: 'Solo jefe, subjefe o encargado puede quitar miembros.',
            ephemeral: true
          });
        }

        return removeMemberFromOrg(interaction, org, user);
      }

      if (interaction.commandName === 'setsubjefe') {
        if (!mustBeInChannel(interaction, config.solicitarRangoChannelId, 'solicitar rango')) return;

        const org = getOrgByName(interaction.options.getString('org'));
        const user = interaction.options.getUser('usuario');

        if (!org) {
          return interaction.reply({
            content: 'No encontré esa organización.',
            ephemeral: true
          });
        }

        if (!isOrgBoss(interaction.member, org)) {
          return interaction.reply({
            content: 'Solo jefe o encargado delictivo puede poner subjefes.',
            ephemeral: true
          });
        }

        if (!org.miembros.includes(user.id)) {
          return interaction.reply({
            content: 'Ese usuario primero debe ser miembro de la organización.',
            ephemeral: true
          });
        }

        const orgs = readOrgs();

        if (!org.subjefes.includes(user.id)) {
          org.subjefes.push(user.id);
        }

        const target = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (target) {
          await target.roles.add(config.subjefeDelictivoRoleId).catch(() => null);
        }

        orgs[org.key] = org;
        writeOrgs(orgs);

        await updateDatabaseChannel();

        await logOrg(
          interaction.guild,
          `<@${interaction.user.id}> puso como subjefe a <@${user.id}> en **${org.nombre}**.`
        );

        return interaction.reply({
          content: `${user} ahora es subjefe de **${org.nombre}**.`,
          ephemeral: true
        });
      }

      if (interaction.commandName === 'removesubjefe') {
        if (!mustBeInChannel(interaction, config.solicitarRangoChannelId, 'solicitar rango')) return;

        const org = getOrgByName(interaction.options.getString('org'));
        const user = interaction.options.getUser('usuario');

        if (!org) {
          return interaction.reply({
            content: 'No encontré esa organización.',
            ephemeral: true
          });
        }

        if (!isOrgBoss(interaction.member, org)) {
          return interaction.reply({
            content: 'Solo jefe o encargado delictivo puede quitar subjefes.',
            ephemeral: true
          });
        }

        const orgs = readOrgs();
        org.subjefes = org.subjefes.filter(id => id !== user.id);

        const target = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (target) {
          await target.roles.remove(config.subjefeDelictivoRoleId).catch(() => null);
        }

        orgs[org.key] = org;
        writeOrgs(orgs);

        await updateDatabaseChannel();

        await logOrg(
          interaction.guild,
          `<@${interaction.user.id}> quitó como subjefe a <@${user.id}> en **${org.nombre}**.`
        );

        return interaction.reply({
          content: `${user} ya no es subjefe de **${org.nombre}**.`,
          ephemeral: true
        });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'org_open_create') {
        if (!isEncargado(interaction.member)) {
          return interaction.reply({
            content: 'No tienes permiso para crear organizaciones.',
            ephemeral: true
          });
        }

        return interaction.showModal(buildCreateOrgModal());
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_create_org') {
        return createOrgFromModal(interaction);
      }
    }
  } catch (error) {
    console.error('Error:', error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Ocurrió un error al ejecutar esa acción.',
        ephemeral: true
      }).catch(() => null);
    }
  }
});

client.login(TOKEN);
