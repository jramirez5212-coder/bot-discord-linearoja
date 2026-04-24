const CLIENT_ID = '1495968384259592503';
const GUILD_ID = '1188377448346288158';

// todo tu código aquí...

client.login(TOKEN);

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  AttachmentBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');


const config = {
  guildName: 'LINEA ROJA',

  panelChannelId: '1496674973622734900',
  transcriptChannelId: '1496669850586845204',
  infoChannelId: '1496675767638032394',

  staffCategoryId: '1496662515592200373',
  orgCategoryId: '1496662348998643794',
  policeCategoryId: '1496662415629095002',

  staffRoleId: '1496645390483722341',
  orgRoleId: '1495196576946327653',
  policeRoleId: '1496644453501501532',

  bannerUrl:
    'https://cdn.discordapp.com/attachments/1495196888562012191/1495554719353933934/banner_nombre_logo.png?ex=69e9f71f&is=69e8a59f&hm=faecaa0a33a4453bd6b87843b45ad3914774e82ea50b558db3c5cb84ec5aad06&',
  logoUrl:
    'https://cdn.discordapp.com/attachments/1495196888562012191/1495554787712696463/LINEAROJA_LOGO.png?ex=69e9f72f&is=69e8a5af&hm=34768e98fcabf58fb76bc1763ee422f3308d4d81c9d08a168fd186f8ac96418a&'
};

const CLAIMS_FILE = path.join(__dirname, 'claims.json');

function ensureClaimsFile() {
  if (!fs.existsSync(CLAIMS_FILE)) {
    fs.writeFileSync(CLAIMS_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readClaims() {
  ensureClaimsFile();
  try {
    return JSON.parse(fs.readFileSync(CLAIMS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeClaims(data) {
  fs.writeFileSync(CLAIMS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function incrementClaim(user) {
  const claims = readClaims();

  if (!claims[user.id]) {
    claims[user.id] = {
      tag: user.tag,
      count: 0
    };
  }

  claims[user.id].tag = user.tag;
  claims[user.id].count += 1;

  writeClaims(claims);
  return claims[user.id].count;
}

function getTopClaimers(limit = 10) {
  const claims = readClaims();

  return Object.entries(claims)
    .map(([userId, data]) => ({
      userId,
      tag: data.tag,
      count: data.count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

client.on('guildMemberAdd', async member => {
  try {
    const channel = await member.guild.channels.fetch(config.infoChannelId);

    if (!channel || !channel.isTextBased()) return;

    await channel.send({
      content: [
        `<:LINEAROJALOGO:1496974366364405781> **Bienvenid@ ${member}.**`,
        `*Recuerda https://discordapp.com/channels/1188377448346288158/1188388349799579658 para poder disfrutar del servidor, al tiempo te recomiendo que te informes un poco sobre nuestro servidor aca https://discordapp.com/channels/1188377448346288158/1496676450269397042 .*`,
        '',
        '-> __Nota:__ Recuerda que para entrar al servidor debes pertenecer en una **FACCION**, y aca puedes postular para alguna de ellas:',
        '- https://discordapp.com/channels/1188377448346288158/1496674973622734900'
      ].join('\n')
    });
  } catch (error) {
    console.error('Error enviando bienvenida:', error);
  }
});

function getPanelMessage() {
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle('# <:alarta:1194861655264338062> GUIA PARA LOS NUEVOS')
    .setDescription(
      [
        '<a:emoji_211:1326671803690647695> Si deseas postular tu organización, ser policia o formar parte de la staff abre ticket presionando los botones de abajo.',
        '',
        '```⛔ INFORMACION IMPORTANTE ⛔```',
        '<:add:1325597577210626068> **Policía:** Tener un mínimo de conocimientos sobre códigos y roleplay.',
        '',
        '<:add:1325597577210626068> **Crear Tu Organización:** Minimo **5 integrantes**.',
        '',
        '<:add:1325597577210626068> **Staff:** Tener conocimiento sobre roleplay y tener claras las normativas de LineaRojaRp.',
        '',
        '👇 **¡SI ESTAS INTERESADO EN POSTULAR PRESIONA EL BOTON CORRESPONDIENTE!** 👇'
      ].join('\n')
    )
    .setThumbnail(config.logoUrl)
    .setImage(config.bannerUrl)
    .setFooter({ text: `${config.guildName} • Sistema de Tickets` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_staff_ticket')
      .setLabel('Postulación Staff')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('open_org_ticket')
      .setLabel('Crear Organización')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('open_police_ticket')
      .setLabel('Postulación Policía')
      .setStyle(ButtonStyle.Primary)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

function buildModal(type) {
  if (type === 'staff_apply') {
    const modal = new ModalBuilder()
      .setCustomId('modal_staff_apply')
      .setTitle('Postulación Staff');

    const q1 = new TextInputBuilder()
      .setCustomId('nombre_edad')
      .setLabel('Nombre y edad')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q2 = new TextInputBuilder()
      .setCustomId('experiencia_staff')
      .setLabel('Experiencia en staff')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const q3 = new TextInputBuilder()
      .setCustomId('horario')
      .setLabel('Horario disponible')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q4 = new TextInputBuilder()
      .setCustomId('motivo_staff')
      .setLabel('Por que quieres ser staff')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(q1),
      new ActionRowBuilder().addComponents(q2),
      new ActionRowBuilder().addComponents(q3),
      new ActionRowBuilder().addComponents(q4)
    );

    return modal;
  }

  if (type === 'org_create') {
    const modal = new ModalBuilder()
      .setCustomId('modal_org_create')
      .setTitle('Crear Organización');

    const q1 = new TextInputBuilder()
      .setCustomId('nombre_org')
      .setLabel('Nombre de la organización')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q2 = new TextInputBuilder()
      .setCustomId('lider_org')
      .setLabel('Nombre del líder')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q3 = new TextInputBuilder()
      .setCustomId('miembros_org')
      .setLabel('Cuántos miembros tienes')
      .setPlaceholder('Mínimo 5 integrantes para crearla')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(q1),
      new ActionRowBuilder().addComponents(q2),
      new ActionRowBuilder().addComponents(q3)
    );

    return modal;
  }

  if (type === 'police_apply') {
    const modal = new ModalBuilder()
      .setCustomId('modal_police_apply')
      .setTitle('Postulación Policía');

    const q1 = new TextInputBuilder()
      .setCustomId('nombre_usuario')
      .setLabel('Nombre y usuario de Discord')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q2 = new TextInputBuilder()
      .setCustomId('edad')
      .setLabel('Edad')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q3 = new TextInputBuilder()
      .setCustomId('experiencia')
      .setLabel('Experiencia en roles policiales')
      .setPlaceholder('Cuánto tiempo y media')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const q4 = new TextInputBuilder()
      .setCustomId('motivo')
      .setLabel('Por que quieres ser policía')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(q1),
      new ActionRowBuilder().addComponents(q2),
      new ActionRowBuilder().addComponents(q3),
      new ActionRowBuilder().addComponents(q4)
    );

    return modal;
  }

  if (type === 'rename_ticket') {
    const modal = new ModalBuilder()
      .setCustomId('modal_rename_ticket')
      .setTitle('Renombrar canal');

    const q1 = new TextInputBuilder()
      .setCustomId('new_channel_name')
      .setLabel('Nuevo nombre del canal')
      .setPlaceholder('Ej: soporte-jota')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(q1));
    return modal;
  }

  return null;
}

function getTicketData(modal) {
  const modalId = modal.customId;

  if (modalId === 'modal_staff_apply') {
    return {
      type: 'staff_apply',
      name: 'staff',
      categoryId: config.staffCategoryId,
      reviewRole: config.staffRoleId,
      ticketTitle: 'Postulación Staff',
      ticketCategoryName: 'Staff'
    };
  }

  if (modalId === 'modal_org_create') {
    return {
      type: 'org_create',
      name: 'organizacion',
      categoryId: config.orgCategoryId,
      reviewRole: config.orgRoleId,
      ticketTitle: 'Crear Organización',
      ticketCategoryName: 'Crear Organización'
    };
  }

  if (modalId === 'modal_police_apply') {
    return {
      type: 'police_apply',
      name: 'policia',
      categoryId: config.policeCategoryId,
      reviewRole: config.policeRoleId,
      ticketTitle: 'Postulación Policía',
      ticketCategoryName: 'Policía'
    };
  }

  return null;
}

function getAnswersFromModal(modal) {
  if (modal.customId === 'modal_staff_apply') {
    return [
      ['Nombre y edad', modal.fields.getTextInputValue('nombre_edad')],
      ['Experiencia en staff', modal.fields.getTextInputValue('experiencia_staff')],
      ['Horario disponible', modal.fields.getTextInputValue('horario')],
      ['Por que quieres ser staff', modal.fields.getTextInputValue('motivo_staff')]
    ];
  }

  if (modal.customId === 'modal_org_create') {
    return [
      ['Nombre de la organización', modal.fields.getTextInputValue('nombre_org')],
      ['Nombre del líder', modal.fields.getTextInputValue('lider_org')],
      ['Cuántos miembros tienes', modal.fields.getTextInputValue('miembros_org')]
    ];
  }

  if (modal.customId === 'modal_police_apply') {
    return [
      ['Nombre y usuario de Discord', modal.fields.getTextInputValue('nombre_usuario')],
      ['Edad', modal.fields.getTextInputValue('edad')],
      ['Experiencia en roles policiales', modal.fields.getTextInputValue('experiencia')],
      ['Por que quieres ser policía', modal.fields.getTextInputValue('motivo')]
    ];
  }

  return [];
}

function buildTicketButtons({ claimed = false } = {}) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Cerrar')
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId('ticket_transcript')
      .setLabel('Transcript')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel(claimed ? 'Ticket asumido' : 'Asumir ticket')
      .setStyle(ButtonStyle.Success)
      .setDisabled(claimed),

    new ButtonBuilder()
      .setCustomId('ticket_rename')
      .setLabel('Renombrar canal')
      .setStyle(ButtonStyle.Primary)
  );
}

function sanitizeChannelName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

function buildTicketEmbed(user, data) {
  return new EmbedBuilder()
    .setColor(0xff0000)
    .setAuthor({
      name: 'LineaRojaRp',
      iconURL: config.logoUrl
    })
    .setDescription(
      [
        `Bienvenido a los tickets **LineaRojaRp**. Los miembros del staff te atenderán lo más rápido posible.`,
        '',
        '**Usuario**',
        `<@${user.id}>`,
        '',
        '**Categoría**',
        data.ticketCategoryName,
        '',
        '**Staff**',
        '`Nadie ha asumido el ticket`',
        '',
        '**Estado del ticket**',
        '`El ticket está actualmente abierto`'
      ].join('\n')
    )
    .setThumbnail(config.logoUrl);
}

function getRoleByTicketType(ticketType) {
  if (ticketType === 'staff_apply') return config.staffRoleId;
  if (ticketType === 'org_create') return config.orgRoleId;
  if (ticketType === 'police_apply') return config.policeRoleId;
  return null;
}

function getTicketInfoFromChannel(channel) {
  if (!channel?.topic) return null;

  const parts = channel.topic.split('-');
  if (parts.length < 2) return null;

  const openerId = parts[0];
  const ticketType = parts.slice(1).join('-');
  const roleId = getRoleByTicketType(ticketType);

  return {
    openerId,
    ticketType,
    roleId
  };
}

function canManageTicket(interaction) {
  const info = getTicketInfoFromChannel(interaction.channel);
  if (!info) return false;

  const member = interaction.member;
  if (!member?.roles?.cache) return false;

  return info.roleId ? member.roles.cache.has(info.roleId) : false;
}

function getNoPermissionMessage() {
  return {
    content: 'Solo los miembros encargados de este ticket pueden utilizar este comando.',
    ephemeral: true
  };
}

async function createTicketChannel(interaction, data, answers) {
  const guild = interaction.guild;

  const existingChannel = guild.channels.cache.find(
    ch =>
      ch.parentId === data.categoryId &&
      ch.topic === `${interaction.user.id}-${data.type}`
  );

  if (existingChannel) {
    await interaction.reply({
      content: `Ya tienes un ticket abierto de este tipo en ${existingChannel}.`,
      ephemeral: true
    });
    return null;
  }

  const usernameClean = sanitizeChannelName(interaction.user.username).slice(0, 10);
  const channelName = `${data.name}-${usernameClean}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: data.categoryId,
    topic: `${interaction.user.id}-${data.type}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks
        ]
      },
      {
        id: data.reviewRole,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages
        ]
      }
    ]
  });

  await channel.send({
    content: `<@${interaction.user.id}> tu TICKET fue creado con éxito en el canal ${channel}\n<@${interaction.user.id}>`
  });

  await channel.send({
    content: `<@${interaction.user.id}> <@&${data.reviewRole}>`,
    embeds: [buildTicketEmbed(interaction.user, data)],
    components: [buildTicketButtons({ claimed: false })]
  });

  const answersText = answers
    .map(([q, a]) => `**${q}**\n${a}`)
    .join('\n\n');

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(data.ticketTitle)
        .setDescription(answersText)
        .setThumbnail(config.logoUrl)
    ]
  });

  return channel;
}

async function fetchAllMessages(channel) {
  let all = [];
  let lastId;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const messages = await channel.messages.fetch(options);
    if (!messages.size) break;

    all.push(...messages.values());
    lastId = messages.last().id;

    if (messages.size < 100) break;
  }

  return all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function formatTranscriptMessage(msg) {
  const date = new Date(msg.createdTimestamp).toLocaleString('es-CO', {
    hour12: true
  });

  const content = msg.content?.trim() || '[sin texto]';
  return `[${date}] ${msg.author.tag}: ${content}`;
}

async function sendTranscript(channel, closerUser) {
  const messages = await fetchAllMessages(channel);
  const transcriptText = messages.map(formatTranscriptMessage).join('\n');
  const transcriptName = `transcript-${channel.name}.txt`;

  const buffer = Buffer.from(transcriptText || 'Sin mensajes', 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: transcriptName });

  const info = getTicketInfoFromChannel(channel);
  const opener = info?.openerId
    ? await client.users.fetch(info.openerId).catch(() => null)
    : null;

  const transcriptChannel = await client.channels
    .fetch(config.transcriptChannelId)
    .catch(() => null);

  if (transcriptChannel && transcriptChannel.isTextBased()) {
    await transcriptChannel.send({
      content: `Transcript de ${channel.name}`,
      files: [attachment]
    });

    await transcriptChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff0000)
          .setAuthor({
            name: 'LineaRojaRp',
            iconURL: config.logoUrl
          })
          .setTitle('Ticket Closed')
          .addFields(
            { name: 'Canal', value: channel.name, inline: true },
            { name: 'Usuario', value: opener ? `<@${opener.id}>` : 'No encontrado', inline: true },
            { name: 'Cerrado por', value: `<@${closerUser.id}>`, inline: true },
            {
              name: 'Hora',
              value: new Date().toLocaleString('es-CO', { hour12: true }),
              inline: false
            }
          )
      ]
    });
  }

  if (opener) {
    const dmAttachment = new AttachmentBuilder(buffer, { name: transcriptName });

    await opener.send({
      content: `Transcript de ${channel.name}`,
      files: [dmAttachment]
    }).catch(() => null);

    await opener.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xff0000)
          .setAuthor({
            name: 'LineaRojaRp',
            iconURL: config.logoUrl
          })
          .setTitle('Ticket Closed')
          .addFields(
            { name: 'Canal', value: channel.name, inline: true },
            { name: 'Usuario', value: `<@${opener.id}>`, inline: true },
            { name: 'Cerrado por', value: `<@${closerUser.id}>`, inline: true },
            {
              name: 'Hora',
              value: new Date().toLocaleString('es-CO', { hour12: true }),
              inline: false
            }
          )
      ]
    }).catch(() => null);
  }
}

async function updateClaimEmbed(message, claimer) {
  const oldEmbed = message.embeds[0];
  if (!oldEmbed) return false;

  const desc = oldEmbed.description || '';

  if (!desc.includes('`Nadie ha asumido el ticket`')) {
    return false;
  }

  const updatedDesc = desc.replace(
    '**Staff**\n`Nadie ha asumido el ticket`',
    `**Staff**\n\`${claimer.tag} ha asumido el ticket\``
  );

  const newEmbed = EmbedBuilder.from(oldEmbed).setDescription(updatedDesc);

  await message.edit({
    embeds: [newEmbed],
    components: [buildTicketButtons({ claimed: true })]
  });

  return true;
}

const commands = [
  new SlashCommandBuilder()
    .setName('tickets')
    .setDescription('Enviar el panel de postulaciones')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),

  new SlashCommandBuilder()
    .setName('topclaims')
    .setDescription('Ver quiénes son los que más asumen tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON()
];

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log('Comandos registrados correctamente.');
  } catch (error) {
    console.error('Error registrando comandos:', error);
  }
}

client.once('clientReady', async () => {
  console.log(`Bot conectado como ${client.user.tag}`);
  ensureClaimsFile();
  await registerCommands();
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'tickets') {
        const panel = getPanelMessage();

        await interaction.channel.send(panel);

        return interaction.reply({
          content: 'Panel enviado correctamente.',
          ephemeral: true
        });
      }

      if (interaction.commandName === 'topclaims') {
        const top = getTopClaimers(10);

        if (!top.length) {
          return interaction.reply({
            content: 'Aún no hay tickets asumidos registrados.',
            ephemeral: true
          });
        }

        const description = top
          .map((item, index) => `**${index + 1}.** <@${item.userId}> — **${item.count}** tickets`)
          .join('\n');

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle('Top de tickets asumidos')
              .setDescription(description)
              .setThumbnail(config.logoUrl)
          ],
          ephemeral: true
        });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'open_staff_ticket') {
        return await interaction.showModal(buildModal('staff_apply'));
      }

      if (interaction.customId === 'open_org_ticket') {
        return await interaction.showModal(buildModal('org_create'));
      }

      if (interaction.customId === 'open_police_ticket') {
        return await interaction.showModal(buildModal('police_apply'));
      }

      if (
        interaction.customId === 'ticket_claim' ||
        interaction.customId === 'ticket_transcript' ||
        interaction.customId === 'ticket_rename' ||
        interaction.customId === 'ticket_close'
      ) {
        if (!canManageTicket(interaction)) {
          return interaction.reply(getNoPermissionMessage());
        }
      }

      if (interaction.customId === 'ticket_claim') {
        const updated = await updateClaimEmbed(interaction.message, interaction.user);

        if (!updated) {
          return interaction.reply({
            content: 'Este ticket ya fue asumido.',
            ephemeral: true
          });
        }

        const totalClaims = incrementClaim(interaction.user);

        return interaction.reply({
          content: `Has asumido el ticket correctamente. Ahora llevas **${totalClaims}** tickets asumidos.`,
          ephemeral: true
        });
      }

      if (interaction.customId === 'ticket_rename') {
        return await interaction.showModal(buildModal('rename_ticket'));
      }

      if (interaction.customId === 'ticket_transcript') {
        await interaction.reply({
          content: 'Generando transcript...',
          ephemeral: true
        });

        await sendTranscript(interaction.channel, interaction.user);

        return interaction.followUp({
          content: 'Transcript enviado al canal de transcripts y al privado del usuario.',
          ephemeral: true
        });
      }

      if (interaction.customId === 'ticket_close') {
        await interaction.reply({
          content: 'Cerrando ticket, enviando transcript...',
          ephemeral: true
        });

        await sendTranscript(interaction.channel, interaction.user);

        setTimeout(async () => {
          try {
            await interaction.channel.delete();
          } catch (err) {
            console.error(err);
          }
        }, 3000);

        return;
      }
    }

    if (interaction.isModalSubmit()) {
      if (
        interaction.customId !== 'modal_staff_apply' &&
        interaction.customId !== 'modal_org_create' &&
        interaction.customId !== 'modal_police_apply' &&
        interaction.customId !== 'modal_rename_ticket'
      ) return;

      if (interaction.customId === 'modal_rename_ticket') {
        if (!canManageTicket(interaction)) {
          return interaction.reply(getNoPermissionMessage());
        }

        const newNameRaw = interaction.fields.getTextInputValue('new_channel_name');
        const newName = sanitizeChannelName(newNameRaw);

        if (!newName) {
          return interaction.reply({
            content: 'El nombre no es válido.',
            ephemeral: true
          });
        }

        await interaction.channel.setName(newName);

        return interaction.reply({
          content: `Canal renombrado a **${newName}**.`,
          ephemeral: true
        });
      }

      const data = getTicketData(interaction);
      const answers = getAnswersFromModal(interaction);

      if (!data) {
        return interaction.reply({
          content: 'No se pudo procesar el formulario.',
          ephemeral: true
        });
      }

      const channel = await createTicketChannel(interaction, data, answers);
      if (!channel) return;

      return interaction.reply({
        content: `Tu ticket fue creado con éxito en el canal ${channel}`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Error en interactionCreate:', error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Hubo un error al procesar esta acción.',
        ephemeral: true
      }).catch(() => null);
    }
  }
});

client.login(TOKEN);