require("dotenv").config();

const {
  Client, GatewayIntentBits, Partials,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  EmbedBuilder, AttachmentBuilder
} = require("discord.js");

const fs   = require("fs");
const path = require("path");
const https = require("https");

const voiceEvent                   = require("./src/events/voiceStateUpdate");
const { handleHoras }              = require("./src/commands/horas");
const { handleHorasRush }          = require("./src/commands/horasRush");
const { handleAnuncios }           = require("./src/commands/anuncios");
const { handleInactividad,
        handleInactividadButton,
        handleInactividadModal,
        handleRegresesButton,
        isExcused }                = require("./src/commands/inactividad");
const { handleTorneo,
        handleTorneoInteraction,
        recoverTorneoRoles }       = require("./src/commands/torneo");
const { handleAdmin,
        handleChiteadoButton }      = require("./src/commands/admin");
const { handleNuevo,
        handleNuevoButton,
        handleTutorialButton,
        handleNuevoFotoSS,
        handleSSResultButton,
        handleBandaButton }         = require("./src/commands/nuevo");
const { handleTandas }             = require("./src/commands/tandas");
const { handleInactividadDecision } = require("./src/commands/inactividadDecision");
const { handleMigrarRoles }        = require("./src/commands/migrarRoles");
const { handleComandosFijados, ensurePinnedCommands, COMANDOS_POR_CANAL } = require("./src/commands/comandosFijados");
const { handleTriunfos, ensurePinnedTriunfos, CANAL_TRIUNFOS_ID, handleTopTriunfos, handleMisTriunfos } = require("./src/commands/triunfos");
const { handleArmarioLogs, handleArmarioCommand, handleTopArmario, handleTopMetio, handleArmarioAlertaButton } = require("./src/commands/armario");
const { startActividadTask }       = require("./src/tasks/actividadTask");
const { startActividadRushTask }   = require("./src/tasks/actividadRushTask");
const { startPresenciaRushTask }   = require("./src/tasks/presenciaRushTask");
const { startInactividadTask }     = require("./src/tasks/inactividadTask");
const { startInactividadRushTask } = require("./src/tasks/inactividadRushTask");
const { startCalendarioTask, handleInscripcionButton, EVENTOS } = require("./src/tasks/calendarioTask");
const { startCalendarioRushTask, handleInscripcionRushButton, EVENTOS: EVENTOS_RUSH } = require("./src/tasks/calendarioRushTask");
const { initPanelEventos, handlePanelButton, handleEmbedCreator, handleAnuncioCmd, handleRecordatorio, handleEncuesta } = require("./src/commands/panelEventos");

global.isExcused = isExcused;

const TOKEN = process.env.TOKEN;
if (!TOKEN) throw new Error("Falta TOKEN en el archivo .env");

const COLOR      = 0x00ff3c;
const SS_ROLE_ID = "1516258951052791818";

const GUILD_VIEJO_ID = "1455775938200473606";
const GUILD_NUEVO_ID = "1188377448346288158";

const config = {
  guildName: "EXLATAM / #300K?",
  guildId: GUILD_NUEVO_ID,
  welcomeChannelId: "1516259293878550589",
  staffBandasRoleId: "1516258946715881592",
  postulacionesPanelChannelId: "1516259307845451917",
  postulacionesChannelId: "1516259309237964971",
  categoriaAprobadosId: "1516259245979603034",
  categoriaRechazadosId: "1516259249246703698",
  botLogsChannelId: "1516259269341745243",
  logoUrl: "https://cdn.discordapp.com/attachments/1442748638848876564/1516299423540449280/ChatGPT_Image_15_jun_2026__23_31_21.pngexxxxxxxxxxxx-removebg-preview.png?ex=6a322362&is=6a30d1e2&hm=ae749a81460b7b70e00e225ddc691f29a37304cf4a6787c419a0886a8b4ad8d6&",
  bannerUrl: "https://cdn.discordapp.com/attachments/1495181084248510555/1496964414467866806/image.png?ex=6a31abc0&is=6a305a40&hm=2f8f3b93ee8f7f7dafadb0f2625c1e295590351ac181941100416f2639e13c97&"
};

// Configuración SOLO de bienvenida + tickets para el servidor VIEJO
const configViejo = {
  guildName: "EXLATAM",
  guildId: GUILD_VIEJO_ID,
  welcomeChannelId: "1469434029475496209",
  ticketPanelChannelId: "1469434046638461231",
  logoUrl: config.logoUrl,
  bannerUrl: config.bannerUrl,
};

const questions = ["Nombre:","Residencia/País?:","Edad (**mínimo 15**)","5 Clips o 1HG:","Foto de las horas de FiveM:","Foto KD (**mínimo 1.8**)","Link Steam Público:","Tiempo Disponible?:","¿Te postulas para ROLAS o RUSH? (escribe exactamente ROLAS o RUSH)"];

const ticketTypes = {
  reportes: { label:"Reportes", emoji:"⛔",  categoryId:"1516259251750834226", roleId:"1516258948871753902", description:"⚠️ **Cuéntanos en qué te podemos ayudar.**\n\n~ Usuario reportado:\n~ Motivo del reporte:\n~ Pruebas / clips:\n~ Explicación completa de lo sucedido:" },
  compras:  { label:"Compras",  emoji:"<:emoji_24:1486354461558308944>", categoryId:"1516259250379161641", roleId:"1516258940411842751", description:"⚠️ **Mientras tanto dinos qué te gustaría comprar de la tienda:**\n\n~ Producto:\n~ Cantidad:\n~ Método de pago:\n~ ¿Está en stock?:" },
  partners: { label:"Partners", emoji:"🤝", categoryId:"1516259252967051284", roleId:"1516258948871753902", description:"⚠️ **Solicitud de partner**\n\n~ Nombre del servidor:\n~ Invitación:\n~ Miembros:\n~ ¿Qué tipo de alianza quieres hacer?:\n~ ¿Qué puedes ofrecer como partner?:" }
};

// Tickets del servidor VIEJO — "Recompensa" en lugar de "Reportes"
const ticketTypesViejo = {
  recompensa: { label:"Recompensa", emoji:"🎁",  categoryId:"1469433997191811308", roleId:"1481851324395163759", description:"⚠️ **Cuéntanos qué recompensa quieres reclamar.**\n\n~ ¿Qué recompensa quieres reclamar?:\n~ ¿Cómo la obtuviste? (clips/pruebas):\n~ Usuario que la otorgó (si aplica):\n~ Explicación completa:" },
  compras:    { label:"Compras",    emoji:"<:emoji_24:1486354461558308944>", categoryId:"1469433995371483320", roleId:"1481851324395163759", description:ticketTypes.compras.description },
  partners:   { label:"Partners",   emoji:"🤝", categoryId:"1469433998722732279", roleId:"1469433860293918921", description:ticketTypes.partners.description }
};

const getTicketTypesFor = guildId => guildId === GUILD_VIEJO_ID ? ticketTypesViejo : ticketTypes;

const appFile  = "./applications.json";
const metaFile = "./rolas_meta.json";
for (const file of [appFile, metaFile]) { if (!fs.existsSync(file)) fs.writeFileSync(file, "{}"); }

const loadJson = f => { try { return JSON.parse(fs.readFileSync(f,"utf8")); } catch { return {}; } };
const saveJson = (f,d) => fs.writeFileSync(f, JSON.stringify(d,null,2));
const loadApps = () => loadJson(appFile);
const saveApps = d => saveJson(appFile, d);
const loadMeta = () => loadJson(metaFile);
const saveMeta = d => saveJson(metaFile, d);

const colombiaDate = () => new Date().toLocaleDateString("en-CA",{timeZone:"America/Bogota"});
const colombiaTime = () => new Date().toLocaleTimeString("es-CO",{timeZone:"America/Bogota",hour:"2-digit",minute:"2-digit",hour12:true});
const todayFooter  = n => `Ahora somos ${n} miembros • hoy a las ${new Date().toLocaleTimeString("es-CO",{hour:"numeric",minute:"2-digit",hour12:true})}`;
const cleanName        = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,35);
const cleanChannelName = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"").slice(0,80);
const answerFromMessage = m => { const t=m.content?.trim()||""; const f=m.attachments.map(a=>a.url); return [t,...f].filter(Boolean).join("\n")||"Sin respuesta"; };
const isStaffMember    = m => m?.roles?.cache?.has(config.staffBandasRoleId) || m?.permissions?.has(PermissionFlagsBits.Administrator);
const canStaff         = i => i.member?.roles?.cache?.has(config.staffBandasRoleId) || i.member?.permissions?.has(PermissionFlagsBits.Administrator);
const getTicketTypeFromChannel = ch => ch?.topic?.match(/ticketType:([a-zA-Z0-9_-]+)/)?.[1] || null;
const canManageThisTicket = i => { if (!i.member) return false; if (i.member.permissions.has(PermissionFlagsBits.Administrator)) return true; const types=getTicketTypesFor(i.guild.id); const t=types[getTicketTypeFromChannel(i.channel)]; return t?i.member.roles.cache.has(t.roleId):false; };
const ROL_VER_RENOMBRAR_TICKET_ID = "1516258952101363712"; // ve el ticket, puede renombrar y solicitar SS, NO puede cerrar
const canRenombrarTicket = i => canManageThisTicket(i) || i.member?.roles?.cache?.has(ROL_VER_RENOMBRAR_TICKET_ID);
const getTicketUserId  = ch => ch.topic?.match(/postulacionUser:(\d+)/)?.[1] || null;

const buildRenameTicketModal = () => { const m=new ModalBuilder().setCustomId("modal_rename_ticket").setTitle("Renombrar ticket"); m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("new_name").setLabel("Nuevo nombre del canal").setPlaceholder("Ejemplo: reporte-juan").setStyle(TextInputStyle.Short).setRequired(true))); return m; };
const renameResultModal      = () => { const m=new ModalBuilder().setCustomId("modal_rename_resultado").setTitle("Renombrar ticket"); m.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("new_name").setLabel("Nuevo nombre del canal").setPlaceholder("Ejemplo: aprobado-juan").setStyle(TextInputStyle.Short).setRequired(true))); return m; };

const resultTicketButtons = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("cerrar_resultado_ticket").setLabel("Cerrar ticket").setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId("renombrar_resultado_ticket").setLabel("Renombrar ticket").setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId("solicitar_ss").setLabel("Solicitar encargado de SS").setStyle(ButtonStyle.Secondary).setEmoji("📋")
);

const decisionButtons = id => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`aprobar_${id}`).setLabel("Aprobar").setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId(`rechazar_${id}`).setLabel("Rechazar").setStyle(ButtonStyle.Danger)
);

const questionEmbed = i => new EmbedBuilder().setColor(COLOR)
  .setAuthor({name:"EXLATAM Postulaciones",iconURL:config.logoUrl})
  .setTitle("📝 | Postulación")
  .setDescription(`**${i+1}/${questions.length}. ${questions[i]}**\n\nResponde enviando un mensaje. Puedes enviar texto, links o imágenes.`)
  .setFooter({text:config.guildName,iconURL:config.logoUrl});

// Embed de postulación con formato bonito
const buildApplicationEmbed = (user, app) => {
  const fields = questions.map((q, i) => {
    const answer = app.answers[i] || "Sin respuesta";
    return { name: `**${q}**`, value: answer, inline: false };
  });

  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({name:"EXLATAM Postulaciones", iconURL:config.logoUrl})
    .setTitle("📝 **POSTULACIÓN**")
    .setThumbnail(user.displayAvatarURL({dynamic:true}))
    .addFields(
      {name:"👤 Usuario", value:`${user}`, inline:true},
      {name:"🆔 ID",      value:user.id,   inline:true},
      {name:"📊 Estado",  value:"`Pendiente`", inline:true},
      ...fields
    )
    .setFooter({text:config.guildName, iconURL:config.logoUrl})
    .setTimestamp();
};

const buildPanel = () => ({
  embeds:[new EmbedBuilder().setColor(COLOR).setAuthor({name:"EXLATAM Postulaciones",iconURL:config.logoUrl}).setTitle("📝 Sistema de Postulaciones").setDescription("**Bienvenido al sistema oficial de postulaciones de EXLATAM.**\n\nPresiona el botón de abajo para iniciar. El bot te hará las preguntas una por una por DM.\n\nCuando termines, tu postulación llegará al equipo de staff para aprobarla o rechazarla.").setThumbnail(config.logoUrl).setImage(config.bannerUrl).setFooter({text:"EXLATAM • Sistema de Postulaciones",iconURL:config.logoUrl})],
  components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("start_postulacion").setLabel("Iniciar postulación").setEmoji("📝").setStyle(ButtonStyle.Success))]
});

const ticketPanel = (guildId) => {
  const esViejo = guildId === GUILD_VIEJO_ID;
  const label   = esViejo ? "Recompensa" : "Reportes";
  const emoji   = esViejo ? "🎁" : "⛔";
  const customId = esViejo ? "ticket_recompensa" : "ticket_reportes";
  const lineaDesc = esViejo
    ? "<:emoji_6:1485010432514326558> __Recompensa:__ Reclamar alguna recompensa."
    : "<:emoji_6:1485010432514326558> __Reportes:__ Reportar alguna inconformidad.";
  return {
    embeds:[new EmbedBuilder().setColor(COLOR).setTitle("<:emoji_16:1486354271351078923> SISTEMA TICKETS EXLATAM").setDescription(`<:emoji_13:1485010590358568970>  *Si deseas abrir algun ticket lo puedes hacer presionando los botones de abajo:*\n\n\`\`\`INFORMACION IMPORTANTE\`\`\`\n${lineaDesc}\n<:emoji_6:1485010432514326558> __Compras:__ Compras en nuestra tienda.\n<:emoji_6:1485010432514326558> __Partners:__ Alianzas entre discord (PUBLICIDAD).\n\n👇 **SELECCIONA EL TICKET QUE NECESITAS** 👇`).setThumbnail(config.logoUrl).setImage(config.bannerUrl).setFooter({text:"TICKETS"})],
    components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(customId).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId("ticket_compras").setLabel("Compras").setEmoji("🛍️").setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId("ticket_partners").setLabel("Partners").setEmoji("🤝").setStyle(ButtonStyle.Primary))]
  };
};

async function botLog(emoji,titulo,detalle="",origen="auto",ejecutadoPor=null){try{const ch=await client.channels.fetch(config.botLogsChannelId).catch(()=>null);if(!ch?.isTextBased())return;const embed=new EmbedBuilder().setColor(origen==="manual"?0xf0a500:COLOR).setAuthor({name:"EXLATAM Bot — Log",iconURL:config.logoUrl}).setTitle(`${emoji} ${titulo}`).addFields({name:"Origen",value:origen==="manual"?`🖐️ Manual${ejecutadoPor?` — ${ejecutadoPor}`:""}` :"🤖 Automático",inline:true},{name:"Hora",value:colombiaTime(),inline:true},{name:"Fecha",value:colombiaDate(),inline:true}).setFooter({text:config.guildName,iconURL:config.logoUrl}).setTimestamp();if(detalle)embed.setDescription(detalle);await ch.send({embeds:[embed]});}catch(e){console.log("⚠️ botLog:",e.message);}}

async function sendAutoPostulacionesPanel(origen="auto",ejecutadoPor=null){const ch=await client.channels.fetch(config.postulacionesPanelChannelId).catch(()=>null);if(!ch?.isTextBased())return;const meta=loadMeta();if(meta.postulacionesPanelMessageId){const old=await ch.messages.fetch(meta.postulacionesPanelMessageId).catch(()=>null);if(old){await old.edit(buildPanel());}else{const m=await ch.send(buildPanel());meta.postulacionesPanelMessageId=m.id;saveMeta(meta);}}else{const m=await ch.send(buildPanel());meta.postulacionesPanelMessageId=m.id;saveMeta(meta);}await botLog("📝","Panel de postulaciones actualizado",`Canal: <#${config.postulacionesPanelChannelId}>`,origen,ejecutadoPor);}

async function askQuestion(userId){const apps=loadApps();const app=apps[userId];if(!app)return;const user=await client.users.fetch(userId).catch(()=>null);if(!user)return;await user.send({embeds:[questionEmbed(app.current)]});}

// Enviar postulación al staff con archivos adjuntos visibles
async function sendApplicationToStaff(userId) {
  const apps = loadApps();
  const app  = apps[userId];
  if (!app) return;

  const user = await client.users.fetch(userId).catch(() => null);
  const ch   = await client.channels.fetch(config.postulacionesChannelId).catch(() => null);
  if (!user || !ch?.isTextBased()) return;

  try {
    // Recolectar URLs de imágenes/videos de las respuestas
    const archivos = [];
    for (const answer of app.answers) {
      const urls = answer.split("\n").filter(u => u.startsWith("http"));
      for (const url of urls) {
        // Solo adjuntar si es de Discord (ya están en CDN)
        if (url.includes("cdn.discordapp.com") || url.includes("media.discordapp.net")) {
          archivos.push(url);
        }
      }
    }

    const embed = buildApplicationEmbed(user, app);

    // Enviar embed principal
    const msg = await ch.send({
      content: `<@&${config.staffBandasRoleId}> **📝 Nueva postulación de ${user.tag}**`,
      embeds:  [embed],
      components: [decisionButtons(userId)]
    });

    // Enviar archivos adjuntos si hay (imágenes, videos)
    if (archivos.length > 0) {
      const embedMedia = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle("📎 Archivos adjuntos de la postulación")
        .setDescription(archivos.map((url, i) => `**Archivo ${i+1}:** ${url}`).join("\n"))
        .setFooter({text: `Postulación de ${user.tag}`});

      await ch.send({ embeds: [embedMedia] });

      // Enviar imágenes directamente para que se vean en Discord
      for (const url of archivos.slice(0, 5)) {
        try {
          await ch.send({ content: url });
        } catch {}
      }
    }

    app.staffMessageId = msg.id;
    app.status = "pendiente";
    apps[userId] = app;
    saveApps(apps);
    await botLog("📨","Postulación enviada",`<@${userId}>`,"auto");
  } catch(e) { console.log("❌", e.message); }
}

async function createResultTicket(userId, status, staffUser, banda = null) {
  try {
    const guild   = await client.guilds.fetch(config.guildId);
    const user    = await client.users.fetch(userId).catch(() => null);
    if (!user) return null;
    const approved = status === "aprobada";
    const bandaLabel = banda ? `-${banda.toLowerCase()}` : "";

    const ch = await guild.channels.create({
      name: `${approved?"aprobado":"rechazado"}${bandaLabel}-${cleanName(user.username)}`,
      type: ChannelType.GuildText,
      parent: approved ? config.categoriaAprobadosId : config.categoriaRechazadosId,
      topic: `postulacionUser:${userId} | status:${status} | staff:${staffUser.id} | banda:${banda||"?"} | createdAt:${Date.now()}`,
      permissionOverwrites: [
        {id:guild.roles.everyone.id, deny:[PermissionFlagsBits.ViewChannel]},
        {id:userId, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.EmbedLinks]},
        {id:config.staffBandasRoleId, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageMessages,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.EmbedLinks]}
      ]
    });

    const embed = new EmbedBuilder()
      .setColor(approved ? COLOR : 0xff3c3c)
      .setAuthor({name:"EXLATAM Postulaciones", iconURL:config.logoUrl})
      .setTitle(approved ? `✅ **POSTULACIÓN** Aprobada${banda ? ` — ${banda}` : ""}` : "❌ **POSTULACIÓN** Rechazada")
      .setDescription(approved
        ? `Tu **POSTULACIÓN** fue **aprobada** por ${staffUser}.\n\nFuiste asignado a la banda **${banda || "?"}**.\n\nAhora pasas a la **segunda etapa del proceso**, la cual se realizará por **llamada**.\n\nCuando el staff te notifique, deberás entrar a la **sala de espera** para continuar con la entrevista.`
        : `Tu **POSTULACIÓN** fue **rechazada** por ${staffUser}.\n\nPuedes usar este ticket para preguntar el motivo o apelar la decisión de forma respetuosa.`
      )
      .addFields(
        {name: "👤 Solicitante",  value: `<@${userId}>`,      inline: true},
        {name: "⚖️ Revisado por", value: `${staffUser}`,      inline: true},
        {name: "📊 Estado",       value: approved ? "`Aprobada`" : "`Rechazada`", inline: true},
        ...(banda && approved ? [{name: "🎯 Banda", value: `**${banda}**`, inline: true}] : []),
      )
      .setThumbnail(config.logoUrl)
      .setFooter({text:config.guildName, iconURL:config.logoUrl})
      .setTimestamp();

    await ch.send({content:`<@${userId}> <@&${config.staffBandasRoleId}>`, embeds:[embed], components:[resultTicketButtons()]});
    await botLog(approved?"✅":"❌", `Ticket ${approved?"aprobado":"rechazado"} creado`, `Usuario: <@${userId}> | Staff: ${staffUser} | Banda: ${banda||"?"} | Canal: ${ch}`, "auto");
    return ch;
  } catch(e) { console.log("❌", e.message); return null; }
}

async function sendRejectAppealDM(user,staffUser){await user.send({content:`❌ Su **POSTULACIÓN** fue rechazada por ${staffUser}.\n\nSi consideras que hubo un error en la revisión o quieres explicar mejor tu caso, puedes apelar el rechazo presionando el botón de abajo.`,components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`apelar_rechazo_${user.id}`).setLabel("Apelar rechazo").setStyle(ButtonStyle.Primary))]}).catch(()=>null);}

async function startFeedback(userId,status,staffId){const apps=loadApps();apps[userId]=apps[userId]||{};apps[userId].feedback={active:true,step:0,status,staffId,answers:[]};saveApps(apps);const user=await client.users.fetch(userId).catch(()=>null);if(!user)return;await user.send({embeds:[new EmbedBuilder().setColor(COLOR).setAuthor({name:"EXLATAM Postulaciones",iconURL:config.logoUrl}).setTitle("⭐ Califica la atención").setDescription("El ticket fue cerrado.\n\nDel **1 al 5**, ¿cómo calificas la atención recibida?").setFooter({text:config.guildName,iconURL:config.logoUrl})]}).catch(()=>null);}

async function sendFeedbackToStaff(userId){const apps=loadApps();const app=apps[userId];if(!app?.feedback)return;const ch=await client.channels.fetch(config.postulacionesChannelId).catch(()=>null);const user=await client.users.fetch(userId).catch(()=>null);if(!ch?.isTextBased()||!user)return;await ch.send({embeds:[new EmbedBuilder().setColor(COLOR).setAuthor({name:"Feedback de postulación",iconURL:config.logoUrl}).setTitle("⭐ Calificación recibida").addFields({name:"Usuario",value:`<@${userId}>`,inline:true},{name:"Estado",value:app.feedback.status||"No definido",inline:true},{name:"Staff",value:`<@${app.feedback.staffId}>`,inline:true},{name:"Calificación",value:app.feedback.answers[0]||"Sin calificación",inline:false},{name:"Sugerencia / Comentario",value:app.feedback.answers[1]||"Sin comentario",inline:false}).setThumbnail(user.displayAvatarURL({dynamic:true})).setTimestamp()]});await botLog("⭐","Feedback recibido",`<@${userId}> — ${app.feedback.answers[0]||"?"}`,"auto");delete app.feedback;apps[userId]=app;saveApps(apps);}

async function sendTicketPanelViejo(){const ch=await client.channels.fetch(configViejo.ticketPanelChannelId).catch(()=>null);if(!ch?.isTextBased())return;const meta=loadMeta();if(meta.ticketPanelViejoMessageId){const old=await ch.messages.fetch(meta.ticketPanelViejoMessageId).catch(()=>null);if(old){await old.edit(ticketPanel(GUILD_VIEJO_ID));return;}}const m=await ch.send(ticketPanel(GUILD_VIEJO_ID));meta.ticketPanelViejoMessageId=m.id;saveMeta(meta);}

const client = new Client({
  intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildVoiceStates,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.DirectMessages],
  partials:[Partials.Channel,Partials.Message,Partials.User]
});

client.once("clientReady", async () => {
  console.log(`✅ BOT COMPLETO EXLATAM — ${client.user.tag}`);
  voiceEvent.recoverSessions(client);
  recoverTorneoRoles(client);
  startActividadTask(client);
  // RUSH solo tiene sistema de inactividad, no de horas/actividad
  // startActividadRushTask desactivado intencionalmente
  setTimeout(() => startInactividadRushTask(client), 15000);
  startPresenciaRushTask(client);
  startInactividadTask(client);
  startInactividadRushTask(client);
  startCalendarioTask(client);
  startCalendarioRushTask(client);
  await initPanelEventos(client, EVENTOS, EVENTOS_RUSH).catch(e => console.log("⚠️ Panel eventos:", e.message));
  // Mensaje fijado de triunfos al iniciar
  try {
    const canalTriunfos = await client.channels.fetch(CANAL_TRIUNFOS_ID);
    if (canalTriunfos) await ensurePinnedTriunfos(canalTriunfos);
  } catch (e) { console.log("⚠️ Triunfos pin:", e.message); }
  await botLog("🟢","Bot iniciado",`Conectado como **${client.user.tag}**`,"auto");
  await sendAutoPostulacionesPanel("auto").catch(e=>console.log("⚠️",e.message));
  await sendTicketPanelViejo().catch(e=>console.log("⚠️ Panel viejo:",e.message));
  setInterval(()=>sendAutoPostulacionesPanel("auto").catch(()=>{}), 10*60*1000);

  // Mensajes fijados de comandos al iniciar
  for (const channelId of Object.keys(COMANDOS_POR_CANAL)) {
    try {
      const ch = await client.channels.fetch(channelId);
      if (ch) await ensurePinnedCommands(ch);
    } catch (e) { console.log(`⚠️ Comandos fijados ${channelId}:`, e.message); }
  }
});

client.on("guildMemberAdd", async member => {
  try {
    const esViejo = member.guild.id === GUILD_VIEJO_ID;

    if (esViejo) {
      const channel = await member.guild.channels.fetch(configViejo.welcomeChannelId).catch(()=>null);
      if (!channel?.isTextBased()) return;
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setDescription(`*Te damos la bienvenida a* 🐉 **${configViejo.guildName}**`)
        .setThumbnail(member.user.displayAvatarURL({dynamic:true}))
        .setImage(configViejo.bannerUrl)
        .setFooter({text:todayFooter(member.guild.memberCount)});
      await channel.send({content:`${member} **Bienvenido a** __${configViejo.guildName}__ 🚙`, embeds:[embed]});
      return;
    }

    // Servidor nuevo (todo el flujo normal con postulaciones)
    const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(()=>null);
    if (!channel?.isTextBased()) return;
    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setDescription(`*Te damos la bienvenida a* 🐉 **${config.guildName}**,\n*si quieres postular acá lo puedes hacer:* <#${config.postulacionesPanelChannelId}>`)
      .setThumbnail(member.user.displayAvatarURL({dynamic:true}))
      .setImage(config.bannerUrl)
      .setFooter({text:todayFooter(member.guild.memberCount)});
    await channel.send({content:`${member} **Bienvenido a** __${config.guildName}__ 🚙`, embeds:[embed]});
  } catch(e){console.log("⚠️ Bienvenida error:",e.message);}
});

client.on("voiceStateUpdate",(o,n)=>voiceEvent.execute(o,n,client));

client.on("messageCreate", async message => {
  if (message.guild) {
    // Armario primero — Rolas Academy es un bot y necesita procesarse
    await handleArmarioLogs(message);
    await handleComandosFijados(message);
  }

  if (message.author.bot) return; // ignorar otros bots para el resto de comandos

  if (message.guild) {
    await handleHoras(message, client);
    await handleHorasRush(message, client);
    await handleAnuncios(message);
    await handleInactividad(message);
    await handleTorneo(message);
    await handleAdmin(message, client);
    await handleNuevo(message, client);
    await handleNuevoFotoSS(message, client);
    await handleTandas(message);
    await handleMigrarRoles(message, client);
    await handleEmbedCreator(message);
    await handleAnuncioCmd(message);
    await handleRecordatorio(message);
    await handleEncuesta(message);
    await handleTriunfos(message);
    await handleTopTriunfos(message);
    await handleMisTriunfos(message);
    await handleArmarioCommand(message);
    await handleTopArmario(message);
    await handleTopMetio(message);

    // ── Comandos de control del anti-farmeo ──────────────────────────────────
    const cmdAfk = message.content.trim().toLowerCase().split(/\s+/);
    const afkCmds = ["!desactivarafk","!activarafk","!desactivarsilenciadoafk","!activarsilenciadoafk","!desactivarensordecidoafk","!activarensordecidoafk"];
    if (afkCmds.includes(cmdAfk[0])) {
      if (!isStaffMember(message.member)) return message.reply("❌ No tienes permiso.").catch(()=>null);
      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Menciona a un usuario. Ej: `!desactivarafk @usuario`").catch(()=>null);
      const uid = target.id;
      let respuesta = "";
      switch(cmdAfk[0]) {
        case "!desactivarafk":
          voiceEvent.afkExemptos.add(uid);
          voiceEvent.afkExemptosMute.add(uid);
          voiceEvent.afkExemptoDeaf.add(uid);
          respuesta = `✅ **Anti-farmeo desactivado** para ${target} (ensordecido + silenciado).`;
          break;
        case "!activarafk":
          voiceEvent.afkExemptos.delete(uid);
          voiceEvent.afkExemptosMute.delete(uid);
          voiceEvent.afkExemptoDeaf.delete(uid);
          respuesta = `✅ **Anti-farmeo activado** para ${target}.`;
          break;
        case "!desactivarsilenciadoafk":
          voiceEvent.afkExemptosMute.add(uid);
          respuesta = `✅ ${target} ya no será chequeado por estar **silenciado**.`;
          break;
        case "!activarsilenciadoafk":
          voiceEvent.afkExemptosMute.delete(uid);
          respuesta = `✅ ${target} volverá a ser chequeado por estar **silenciado**.`;
          break;
        case "!desactivarensordecidoafk":
          voiceEvent.afkExemptoDeaf.add(uid);
          respuesta = `✅ ${target} ya no será chequeado por estar **ensordecido**.`;
          break;
        case "!activarensordecidoafk":
          voiceEvent.afkExemptoDeaf.delete(uid);
          respuesta = `✅ ${target} volverá a ser chequeado por estar **ensordecido**.`;
          break;
      }
      return message.reply(respuesta).catch(()=>null);
    }

    if (message.content.trim().toLowerCase() === "!panel") {
      if (!isStaffMember(message.member)) return message.reply("❌ No tienes permisos.").catch(()=>null);
      await sendAutoPostulacionesPanel("manual",`<@${message.author.id}>`);
      return message.reply("✅ Panel enviado/actualizado.").catch(()=>null);
    }
    if (message.content === "!paneltickets") {
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply("No tienes permisos.");
      await message.channel.send(ticketPanel(message.guild.id));
      return message.reply("✅ Panel enviado.");
    }
    return;
  }

  // DMs postulaciones
  const userId = message.author.id;
  const apps   = loadApps();
  const app    = apps[userId];
  if (!app) return;

  if (app.feedback?.active) {
    app.feedback.answers.push(answerFromMessage(message));
    if (app.feedback.step === 0) {
      app.feedback.step=1;apps[userId]=app;saveApps(apps);
      return message.author.send({embeds:[new EmbedBuilder().setColor(COLOR).setTitle("📝 Sugerencia").setDescription("Ahora escribe una sugerencia o comentario sobre la atención recibida.").setFooter({text:config.guildName,iconURL:config.logoUrl})]}).catch(()=>null);
    }
    await message.author.send("✅ Gracias por tu calificación.").catch(()=>null);
    apps[userId]=app;saveApps(apps);await sendFeedbackToStaff(userId);return;
  }

  if (app.status !== "respondiendo") return;
  app.answers.push(answerFromMessage(message));
  app.current += 1;

  if (app.current >= questions.length) {
    app.status="enviada";apps[userId]=app;saveApps(apps);
    await message.author.send({embeds:[new EmbedBuilder().setColor(COLOR).setAuthor({name:"EXLATAM Postulaciones",iconURL:config.logoUrl}).setTitle("✅ **POSTULACIÓN** enviada").setDescription("Tu **POSTULACIÓN** fue enviada correctamente. Espera respuesta del staff.").setFooter({text:config.guildName,iconURL:config.logoUrl})]}).catch(()=>null);
    await sendApplicationToStaff(userId);return;
  }
  apps[userId]=app;saveApps(apps);await askQuestion(userId);
});

client.on("interactionCreate", async interaction => {
  try {
    await handleInactividadButton(interaction);
    await handleInactividadModal(interaction, client);
    await handleTorneoInteraction(interaction, client);
    await handleNuevoButton(interaction, client);
    await handleTutorialButton(interaction, client);
    await handleSSResultButton(interaction, client);
    await handleBandaButton(interaction, client);
    await handleChiteadoButton(interaction, client);
    await handleInactividadDecision(interaction, client);
    await handleRegresesButton(interaction, client);
    await voiceEvent.handleAntiFarmeoButton(interaction);
    await handleInscripcionButton(interaction);
    await handleInscripcionRushButton(interaction);
    await handleArmarioAlertaButton(interaction);
    await handlePanelButton(interaction, EVENTOS, EVENTOS_RUSH);
    if (interaction.replied || interaction.deferred) return;

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "modal_rename_ticket") {
        if (!canRenombrarTicket(interaction)) return interaction.reply({content:"No tienes permisos.",ephemeral:true});
        const n=cleanChannelName(interaction.fields.getTextInputValue("new_name"));if(!n)return interaction.reply({content:"Nombre inválido.",ephemeral:true});
        await interaction.channel.setName(n);return interaction.reply({content:`✅ Canal renombrado a **${n}**.`,ephemeral:true});
      }
      if (interaction.customId === "modal_rename_resultado") {
        if (!canStaff(interaction)) return interaction.reply({content:"Solo el staff puede renombrar.",ephemeral:true});
        const n=cleanName(interaction.fields.getTextInputValue("new_name"));if(!n)return interaction.reply({content:"Nombre inválido.",ephemeral:true});
        await interaction.channel.setName(n);await botLog("✏️","Ticket renombrado",`**${n}** por <@${interaction.user.id}>`,"manual",`<@${interaction.user.id}>`);
        return interaction.reply({content:`✅ Canal renombrado a **${n}**.`,ephemeral:true});
      }
      return;
    }

    if (!interaction.isButton()) return;

    // Botón solicitar SS
    const ENTREVISTADOR_ROLE_ID = "1516258946715881592";
    const ROL_VER_SOLICITAR_SS_ID = "1516258952101363712"; // ve el ticket + puede solicitar SS, no puede cerrar/renombrar
    const canSolicitar = i => canStaff(i) || i.member?.roles?.cache?.has(ENTREVISTADOR_ROLE_ID) || i.member?.roles?.cache?.has(ROL_VER_SOLICITAR_SS_ID);

    if (interaction.customId === "solicitar_ss") {
      if (!canSolicitar(interaction))
        return interaction.reply({content:"❌ No tienes permiso para solicitar un encargado de SS.",ephemeral:true});
      try {
        await interaction.channel.permissionOverwrites.edit(SS_ROLE_ID, {
          ViewChannel:true, SendMessages:true, ReadMessageHistory:true,
        });
      } catch(e){console.error("[SS] Error:",e.message);}
      await interaction.reply({content:`<@&${SS_ROLE_ID}> Un encargado de SS ha sido solicitado en el ticket!`});
      return;
    }

    if (interaction.customId === "start_postulacion") {
      await interaction.deferReply({ephemeral:true});
      const apps=loadApps();apps[interaction.user.id]={status:"respondiendo",current:0,answers:[],createdAt:Date.now()};saveApps(apps);
      try{await askQuestion(interaction.user.id);await botLog("📝","Postulación iniciada",`<@${interaction.user.id}>`,"auto");return interaction.editReply({content:"📩 Te envié las preguntas por DM. Revisa tus mensajes privados."});}
      catch(e){
        delete apps[interaction.user.id];saveApps(apps);
        try {
          const canalProblemas = await client.channels.fetch("1516259311410614332");
          await canalProblemas.send({embeds:[new EmbedBuilder().setColor(0xe74c3c).setTitle("⚠️ Problema al iniciar postulación").setDescription(`${interaction.user} intentó postular pero no se pudo enviar el DM (privados cerrados o error).`).setTimestamp()]});
        } catch {}
        return interaction.editReply({content:"No pude enviarte DM. Activa los mensajes privados e intenta otra vez."});
      }
    }

    if (interaction.customId.startsWith("apelar_rechazo_")) {
      const uid=interaction.customId.replace("apelar_rechazo_","");if(interaction.user.id!==uid)return interaction.reply({content:"Este botón no es para ti.",ephemeral:true});
      const apps=loadApps();const staffId=apps[uid]?.lastRejectStaffId||client.user.id;const su=await client.users.fetch(staffId).catch(()=>client.user);
      const t=await createResultTicket(uid,"rechazada",su);await botLog("🔄","Apelación creada",`<@${uid}>`,"auto");
      return interaction.reply({content:`✅ Ticket de apelación: ${t}`,ephemeral:true});
    }

    if (interaction.customId === "cerrar_resultado_ticket") {
      if (!canStaff(interaction)) return interaction.reply({content:"Solo el staff puede cerrar.",ephemeral:true});
      const uid=getTicketUserId(interaction.channel);await interaction.reply({content:"Cerrando ticket...",ephemeral:true});
      if(uid){const s=interaction.channel.topic?.match(/status:([a-zA-Z]+)/)?.[1]||"cerrada";await startFeedback(uid,s,interaction.user.id);}
      await botLog("🔒","Ticket cerrado",`${interaction.channel.name} | <@${interaction.user.id}>`,"manual",`<@${interaction.user.id}>`);
      setTimeout(()=>interaction.channel.delete().catch(()=>null),3000);return;
    }

    if (interaction.customId === "renombrar_resultado_ticket") {
      if (!canStaff(interaction)) return interaction.reply({content:"Solo el staff puede renombrar.",ephemeral:true});
      return interaction.showModal(renameResultModal());
    }

    if (interaction.customId.startsWith("aprobar_") || interaction.customId.startsWith("rechazar_")) {
      if (!canStaff(interaction)) return interaction.reply({content:"No tienes permisos.",ephemeral:true});
      const approved=interaction.customId.startsWith("aprobar_");const uid=interaction.customId.split("_")[1];
      const user=await client.users.fetch(uid).catch(()=>null);if(!user)return interaction.reply({content:"No encontré al usuario.",ephemeral:true});
      if(approved){
        // Detectar si se postuló para ROLAS o RUSH según la última respuesta
        const apps = loadApps();
        const app  = apps[uid];
        const ultimaRespuesta = app?.answers?.[app.answers.length - 1]?.toLowerCase() || "";
        const esRush = ultimaRespuesta.includes("rush");
        const rolActividad = esRush ? "1518491812593926274" : "1516258966756266054";
        const banda = esRush ? "RUSH" : "ROLAS";

        // Asignar rol de actividad correcto
        try {
          const guild  = await client.guilds.fetch("1188377448346288158");
          const member = await guild.members.fetch(uid).catch(()=>null);
          if (member) await member.roles.add(rolActividad).catch(()=>null);
        } catch(e) { console.error("[POSTULACION] Error asignando rol:", e.message); }

        await user.send({content:`✅ Tu **POSTULACIÓN** fue aprobada por ${interaction.user}.\n\nFuiste asignado a **${banda}**. Se creó un ticket para continuar. La segunda etapa será por llamada.`}).catch(()=>null);
        const t=await createResultTicket(uid,"aprobada",interaction.user, banda);
        await interaction.message.edit({components:[]}).catch(()=>null);
        return interaction.reply({content:`✅ Aprobada (${banda}). Ticket: ${t}`,ephemeral:true});
      }
      await sendRejectAppealDM(user,interaction.user);
      const apps=loadApps();apps[uid]=apps[uid]||{};apps[uid].lastRejectStaffId=interaction.user.id;apps[uid].status="rechazada";apps[uid].reviewedAt=Date.now();saveApps(apps);
      await interaction.message.edit({components:[]}).catch(()=>null);
      return interaction.reply({content:"❌ Rechazada. DM enviado.",ephemeral:true});
    }

    if (interaction.customId === "cerrar_ticket") {
      if (!canManageThisTicket(interaction)) return interaction.reply({content:"Solo el staff puede cerrar.",ephemeral:true});
      await interaction.reply({content:"Cerrando ticket...",ephemeral:true});
      setTimeout(()=>interaction.channel.delete().catch(()=>null),3000);return;
    }

    if (interaction.customId === "renombrar_ticket") {
      if (!canRenombrarTicket(interaction)) return interaction.reply({content:"Solo el staff puede renombrar.",ephemeral:true});
      return interaction.showModal(buildRenameTicketModal());
    }

    if (!interaction.customId.startsWith("ticket_")) return;
    const type=interaction.customId.replace("ticket_","");const types=getTicketTypesFor(interaction.guild.id);const ticket=types[type];if(!ticket)return;

    // Botón Compras: en el servidor NUEVO manda mensaje de shop (no crea ticket). En el VIEJO abre ticket normal.
    if (type === "compras" && interaction.guild.id !== GUILD_VIEJO_ID) {
      const embedShop = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle("🛍️ NUESTRA SHOP")
        .setDescription("**EXSHOP.GG** <:ex:1516310233956483092>\n\nEntra a nuestra tienda para ver los productos disponibles 👇")
        .setThumbnail(config.logoUrl);
      const btnShop = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("Ir a la Shop").setStyle(ButtonStyle.Link).setURL("https://discord.gg/USVCfqmB3S")
      );
      return interaction.reply({embeds:[embedShop], components:[btnShop], ephemeral:true});
    }

    const guildNombre = interaction.guild.id===GUILD_VIEJO_ID ? configViejo.guildName : config.guildName;
    const existing=interaction.guild.channels.cache.find(ch=>ch.topic?.includes(`ticketOwner:${interaction.user.id}`)&&ch.topic?.includes(`ticketType:${type}`));
    if(existing)return interaction.reply({content:`Ya tienes un ticket: ${existing}`,ephemeral:true});

    // Verificar que los roles existen en el guild antes de usarlos en permissionOverwrites
    await interaction.guild.roles.fetch();
    const rolTicket   = interaction.guild.roles.cache.get(ticket.roleId);
    const rolEspecial = interaction.guild.roles.cache.get("1516258952101363712");

    const overwrites = [
      {id:interaction.guild.roles.everyone.id, deny:[PermissionFlagsBits.ViewChannel]},
      {id:interaction.user.id, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.EmbedLinks]},
    ];
    if (rolTicket)   overwrites.push({id:ticket.roleId, allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageMessages,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.EmbedLinks]});
    if (rolEspecial) overwrites.push({id:"1516258952101363712", allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});

    const ch=await interaction.guild.channels.create({name:`${type}-${cleanChannelName(interaction.user.username)}`,type:ChannelType.GuildText,parent:ticket.categoryId,topic:`ticketOwner:${interaction.user.id} | ticketType:${type}`,permissionOverwrites:overwrites});
    const embed=new EmbedBuilder().setColor(COLOR).setTitle(`${ticket.emoji} ${ticket.label}`).setDescription(ticket.description).setThumbnail(config.logoUrl).setFooter({text:guildNombre});
    const btns=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("cerrar_ticket").setLabel("Cerrar").setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId("renombrar_ticket").setLabel("Renombrar").setStyle(ButtonStyle.Primary));
    await ch.send({content:`<@${interaction.user.id}> Has abierto un ticket de (${ticket.emoji} **${ticket.label}**). Espera que un <@&${ticket.roleId}> te atienda.`,embeds:[embed],components:[btns]});
    return interaction.reply({content:`✅ Ticket creado en ${ch}`,ephemeral:true});

  } catch(error) {
    console.error(error);
    if(!interaction.replied&&!interaction.deferred) await interaction.reply({content:"Ocurrió un error.",ephemeral:true}).catch(()=>null);
  }
});

client.on("error",e=>console.log("⚠️ Error:",e.message));
process.on("unhandledRejection",e=>console.log("⚠️ Promesa rechazada:",e?.message||e));

client.login(TOKEN);
