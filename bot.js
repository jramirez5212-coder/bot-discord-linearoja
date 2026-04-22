console.log("CAMBIOOOOOOOOO");

// ===== IMPORTS =====
const {
    Client,
    GatewayIntentBits,
    PermissionsBitField,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// ===== CLIENT =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ===== CONFIG =====
const TOKEN = process.env.TOKEN;

const CANAL_BIENVENIDA_ID = "1495196891124600853";
const CANAL_TICKETS_PANEL = "1495196994329645149";
const CANAL_PANEL_EMBEDS = "1495196970032304128";


const IMAGEN_BANNER = "https://cdn.discordapp.com/attachments/1495196888562012191/1495554719353933934/banner_nombre_logo.png";
const IMAGEN_LOGO = "https://cdn.discordapp.com/attachments/1495196888562012191/1495554787712696463/LINEAROJA_LOGO.png";

// ===== CATEGORIAS =====
const CATEGORIAS = {
    soporte: { nombre: "Soporte", parentId: "1495580733274587237" },
    donaciones: { nombre: "Donaciones", parentId: "1495582260957679770" },
    postulaciones: { nombre: "Postulaciones", parentId: "1495582414984970261" },
    reportes: { nombre: "Reportes", parentId: "1495582547046957197" },
    bugs: { nombre: "Reportar Bugs", parentId: "1495582547046957197" },
    apelacion: { nombre: "Apelar Ban", parentId: "1495582620740751400" },
    ck: { nombre: "Solicitar CK / PKT", parentId: "1495582706359074938" }
};

// ===== ROLES POR TICKET =====
const ROLES_TICKETS = {
    ck: ["1495581819167309886"],
    apelacion: ["1495581737017802843"],
    postulaciones: ["1495196578246557889"],
    reportes: ["1495196578246557889"],
    soporte: ["1495196578246557889"],
    donaciones: ["1495581556117475369"]
};

// ===== UTILS =====
function limpiarNombre(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30);
}

async function contarTicketsUsuario(guild, userId) {
    return guild.channels.cache.filter(
        c => c.topic && c.topic.includes(`ticketOwner:${userId}`)
    );
}

function buildTicketButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("cerrar")
            .setLabel("Cerrar")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("transcript")
            .setLabel("Transcript")
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("claim")
            .setLabel("Asumir ticket")
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId("renombrar")
            .setLabel("Renombrar canal")
            .setStyle(ButtonStyle.Primary)
    );
}

// ===== PANEL CREADOR DE EMBEDS =====
function buildEmbedCreatorPanel() {
    const embed = new EmbedBuilder()
        .setTitle("Creador de embeds • LineaRojaRp")
        .setDescription("Pulsa el botón de abajo para crear un embed personalizado desde Discord.")
        .setColor("#ff0000")
        .setThumbnail(IMAGEN_LOGO);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("abrir_creador_embed")
            .setLabel("Crear embed")
            .setStyle(ButtonStyle.Primary)
    );

    return { embed, row };
}

// ===== READY =====
client.on("clientReady", () => {
    console.log(`Encendido como: ${client.user.tag}`);
});

// ===== BIENVENIDA (ESTILO BONITO) =====
client.on("guildMemberAdd", async (member) => {
    try {
        const canal = member.guild.channels.cache.get(CANAL_BIENVENIDA_ID);
        if (!canal) return;

        const embed = new EmbedBuilder()
            .setAuthor({
                name: "LineaRojaRp",
                iconURL: IMAGEN_LOGO
            })
            .setTitle("¡Bienvenido!")
            .setDescription(`Hola ${member}\nBienvenido a **LineaRojaRp 🔴**`)
            .setColor("#ff0000")
            .setThumbnail(IMAGEN_LOGO)
            .setImage(IMAGEN_BANNER);

        await canal.send({ embeds: [embed] });
    } catch (error) {
        console.log("Error en bienvenida:", error);
    }
});

// ===== PANEL =====
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (message.content === "!tickets") {
        const canal = message.guild.channels.cache.get(CANAL_TICKETS_PANEL);
        if (!canal) return;

        const embed = new EmbedBuilder()
            .setTitle("Tickets LineaRojaRp")
            .setDescription("Bienvenido al sistema de tickets LineaRojaRp pulsa el botón de abajo para crear un ticket.")
            .setColor("#ff0000")
            .setThumbnail("https://media.discordapp.net/attachments/1495196888562012191/1495554787712696463/LINEAROJA_LOGO.png")
            .setImage("https://media.discordapp.net/attachments/1495196888562012191/1495554719353933934/banner_nombre_logo.png");

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("menu")
                .setPlaceholder("Selecciona una categoría")
                .addOptions([
                    {
                        label: "Soporte",
                        description: "Si solicitas soporte presiona aquí.",
                        value: "soporte",
                        emoji: { id: "1194861655264338062", name: "alarta" }
                    },
                    {
                        label: "Donaciones",
                        description: "Si deseas donar al servidor presiona aca.",
                        value: "donaciones",
                        emoji: { id: "1192599916787277845", name: "chack" }
                    },
                    {
                        label: "Postulaciones",
                        description: "Si deseas postular a alguna facción o a staff presiona acá.",
                        value: "postulaciones",
                        emoji: { id: "1192599900475637851", name: "chack" }
                    },
                    {
                        label: "Reportes",
                        description: "Si deseas reportar presiona acá.",
                        value: "reportes",
                        emoji: { id: "1192599857635016855", name: "chack" }
                    },
                    {
                        label: "Reportar Bugs",
                        description: "Si viste algún bug en el servidor presiona acá.",
                        value: "bugs",
                        emoji: { id: "1192599887427162182", name: "chack" }
                    },
                    {
                        label: "Apelar Ban",
                        description: "Si quieres apelar tu ban presiona acá.",
                        value: "apelacion",
                        emoji: { id: "1192599873095209168", name: "chack" }
                    },
                    {
                        label: "Solicitar CKs o PKTs",
                        description: "Si quieres solicitar un CK o PKT presiona acá.",
                        value: "ck",
                        emoji: { id: "1192599928892051656", name: "chack" }
                    }
                ])
        );

        await canal.send({ embeds: [embed], components: [menu] });
    }

    if (message.content === "!panelembed") {
        if (!message.member.roles.cache.has(ROL_STAFF)) {
            return message.reply("No tienes permiso.");
        }

        const canal = message.guild.channels.cache.get(CANAL_PANEL_EMBEDS);
        if (!canal) return message.reply("No encontré el canal.");

        const { embed, row } = buildEmbedCreatorPanel();

        await canal.send({
            embeds: [embed],
            components: [row]
        });

        await message.reply("Panel de embeds enviado.");
    }
});

// ===== CREAR TICKET =====
async function crearTicket(interaction, tipo, extra = "") {
    const user = interaction.user;

    const tickets = await contarTicketsUsuario(interaction.guild, user.id);

    if (tickets.size >= 2) {
        return interaction.reply({
            content: "Ya tienes el máximo de 2 tickets abiertos.",
            ephemeral: true
        });
    }

    const existeCategoria = tickets.find(c => c.name.startsWith(tipo));

    if (existeCategoria) {
        return interaction.reply({
            content: "Ya tienes un ticket abierto en esta categoría.",
            ephemeral: true
        });
    }

    const categoria = CATEGORIAS[tipo];

    const permisos = [
        {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
            id: user.id,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages
            ]
        }
    ];

    const rolesPermitidos = ROLES_TICKETS[tipo] || [];

    for (const rolId of rolesPermitidos) {
        permisos.push({
            id: rolId,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ManageChannels
            ]
        });
    }

    const canal = await interaction.guild.channels.create({
        name: `${tipo}-${limpiarNombre(user.username)}`,
        type: ChannelType.GuildText,
        parent: categoria.parentId,
        topic: `ticketOwner:${user.id} | ticketCategory:${tipo}`,
        permissionOverwrites: permisos
    });

    // 🔥 ESTE ES EL FIX REAL (NO TOCAR MÁS)
    await canal.permissionOverwrites.set(permisos);

    const embed = new EmbedBuilder()
        .setAuthor({ name: "LineaRojaRp", iconURL: IMAGEN_LOGO })
        .setDescription(`Bienvenido a los tickets **LineaRojaRp**. Los miembros del staff te atenderán lo más rápido posible.${extra ? `\n\n${extra}` : ""}`)
        .addFields(
            { name: "Usuario", value: `${user}`, inline: false },
            { name: "Categoría", value: categoria.nombre, inline: false },
            { name: "Staff", value: "`Nadie ha asumido el ticket`", inline: false },
            { name: "Estado del ticket", value: "`El ticket está actualmente abierto`", inline: false }
        )
        .setColor("#ff0000")
        .setThumbnail(IMAGEN_LOGO);

    await canal.send({
        content: `${user} tu TICKET fue creado con éxito en el canal ${canal}`
    });

    await canal.send({
        content: `<@${user.id}>`,
        embeds: [embed],
        components: [buildTicketButtons()]
    });

    return interaction.reply({
        content: `Ticket creado: ${canal}`,
        ephemeral: true
    });
}

async function generarTranscript(channel) {
    const messages = await channel.messages.fetch({ limit: 100 });
    const ordenados = Array.from(messages.values()).reverse();

    let contenido = `Transcript de ${channel.name}\n\n`;

    for (const msg of ordenados) {
        const fecha = new Date(msg.createdTimestamp).toLocaleString("es-CO");
        contenido += `[${fecha}] ${msg.author.tag}: ${msg.content || "(sin texto)"}\n`;
    }

    const ruta = path.join(__dirname, `transcript-${channel.id}.txt`);
    fs.writeFileSync(ruta, contenido, "utf8");
    return ruta;
}

// ===== INTERACCIONES =====
client.on("interactionCreate", async (interaction) => {
    try {
        // =========================
        // MENU DE TICKETS
        // =========================
        if (interaction.isStringSelectMenu() && interaction.customId === "menu") {
            const valor = interaction.values[0];

            if (valor === "reportes") {
                const modal = new ModalBuilder()
                    .setCustomId("modal_reportes")
                    .setTitle("Reportar");

                const idReportado = new TextInputBuilder()
                    .setCustomId("id_reportado")
                    .setLabel("Id persona reportada IC")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Id | Null")
                    .setRequired(true);

                const pruebas = new TextInputBuilder()
                    .setCustomId("pruebas")
                    .setLabel("¿Tienes pruebas de lo sucedido?")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("Si | No")
                    .setRequired(true);

                const razon = new TextInputBuilder()
                    .setCustomId("razon")
                    .setLabel("Pon la razón por la que estás reportando")
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder("Razón")
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(idReportado),
                    new ActionRowBuilder().addComponents(pruebas),
                    new ActionRowBuilder().addComponents(razon)
                );

                return interaction.showModal(modal);
            }

            return crearTicket(interaction, valor);
        }

        // =========================
        // MODAL REPORTES
        // =========================
        if (interaction.isModalSubmit() && interaction.customId === "modal_reportes") {
            const idReportado = interaction.fields.getTextInputValue("id_reportado");
            const pruebas = interaction.fields.getTextInputValue("pruebas");
            const razon = interaction.fields.getTextInputValue("razon");

            const extra = [
                "**Formulario enviado**",
                `**Id persona reportada IC:** ${idReportado}`,
                `**¿Tienes pruebas?:** ${pruebas}`,
                `**Razón:** ${razon}`
            ].join("\n");

            return crearTicket(interaction, "reportes", extra);
        }

        // =========================
        // MODAL RENOMBRAR
        // =========================
        if (interaction.isModalSubmit() && interaction.customId === "modal_renombrar") {
            const nuevoNombre = limpiarNombre(
                interaction.fields.getTextInputValue("nuevo_nombre")
            );

            await interaction.channel.setName(nuevoNombre);

            return interaction.reply({
                content: `Canal renombrado a **${nuevoNombre}**.`,
                ephemeral: true
            });
        }

        // =========================
        // MODAL CREAR EMBED
        // =========================
        if (interaction.isModalSubmit() && interaction.customId === "modal_crear_embed") {
            const titulo = interaction.fields.getTextInputValue("titulo");
            const descripcion = interaction.fields.getTextInputValue("descripcion");
            const imagen = interaction.fields.getTextInputValue("imagen");
            const thumbnail = interaction.fields.getTextInputValue("thumbnail");
            const color = interaction.fields.getTextInputValue("color") || "#ff0000";

            const embed = new EmbedBuilder()
                .setTitle(titulo)
                .setDescription(descripcion)
                .setColor(color);

            if (imagen) embed.setImage(imagen);
            if (thumbnail) embed.setThumbnail(thumbnail);

            await interaction.channel.send({ embeds: [embed] });

            return interaction.reply({
                content: "Embed enviado correctamente.",
                ephemeral: true
            });
        }

        // ===== ABRIR CREADOR EMBED =====
        if (interaction.isButton() && interaction.customId === "abrir_creador_embed") {
            const modal = new ModalBuilder()
                .setCustomId("modal_crear_embed")
                .setTitle("Crear embed");

            const titulo = new TextInputBuilder()
                .setCustomId("titulo")
                .setLabel("Título")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const descripcion = new TextInputBuilder()
                .setCustomId("descripcion")
                .setLabel("Descripción")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const imagen = new TextInputBuilder()
                .setCustomId("imagen")
                .setLabel("Imagen (URL)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const thumbnail = new TextInputBuilder()
                .setCustomId("thumbnail")
                .setLabel("Logo derecha (URL)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const color = new TextInputBuilder()
                .setCustomId("color")
                .setLabel("Color HEX (#ff0000)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(titulo),
                new ActionRowBuilder().addComponents(descripcion),
                new ActionRowBuilder().addComponents(imagen),
                new ActionRowBuilder().addComponents(thumbnail),
                new ActionRowBuilder().addComponents(color)
            );

            return interaction.showModal(modal);
        }

        // =========================
        // BOTONES
        // =========================
        if (interaction.isButton()) {

            // ===== CERRAR =====
            if (interaction.customId === "cerrar") {
                await interaction.deferReply({ ephemeral: true });

                const channel = interaction.channel;
                const topic = channel.topic || "";
                const ownerId = topic.match(/ticketOwner:(\d+)/)?.[1];

                const ruta = await generarTranscript(channel);
                const archivo = new AttachmentBuilder(ruta);

                const embed = new EmbedBuilder()
                    .setAuthor({ name: "LineaRojaRp 🔴", iconURL: IMAGEN_LOGO })
                    .setTitle("Ticket Closed")
                    .addFields(
                        { name: "Canal", value: channel.name, inline: true },
                        { name: "Usuario", value: ownerId ? `<@${ownerId}>` : "No encontrado", inline: true },
                        { name: "Cerrado por", value: `${interaction.user}`, inline: true },
                        { name: "Hora", value: new Date().toLocaleString(), inline: false }
                    )
                    .setColor("#ff0000");

                if (ownerId) {
                    try {
                        const user = await client.users.fetch(ownerId);
                        await user.send({
                            embeds: [embed],
                            files: [archivo]
                        });
                    } catch (e) {
                        console.log("No se pudo enviar DM:", e);
                    }
                }

                await interaction.editReply({ content: "Ticket cerrado." });

                setTimeout(async () => {
                    try {
                        await channel.delete();
                    } catch (e) {
                        console.log("Error borrando canal:", e);
                    }
                }, 3000);

                return;
            }

            // ===== TRANSCRIPT =====
            if (interaction.customId === "transcript") {
                await interaction.deferReply({ ephemeral: true });

                const ruta = await generarTranscript(interaction.channel);
                const archivo = new AttachmentBuilder(ruta);

                await interaction.editReply({
                    content: "Aquí está el transcript del ticket.",
                    files: [archivo]
                });

                return;
            }

            // ===== CLAIM =====
            if (interaction.customId === "claim") {
                await interaction.deferReply({ ephemeral: true });

                const mensajes = await interaction.channel.messages.fetch({ limit: 20 });
                const mensajeConEmbed = mensajes.find(
                    m => m.author.id === client.user.id && m.embeds.length > 0
                );

                if (mensajeConEmbed) {
                    const topic = interaction.channel.topic || "";
                    const ownerId = topic.match(/ticketOwner:(\d+)/)?.[1];
                    const categoriaKey = topic.match(/ticketCategory:([a-z]+)/)?.[1] || "soporte";
                    const categoriaTexto = CATEGORIAS[categoriaKey]?.nombre || "Ticket";

                    const nuevoEmbed = new EmbedBuilder()
                        .setAuthor({ name: "LineaRojaRp", iconURL: IMAGEN_LOGO })
                        .setDescription("Bienvenido a los tickets **LineaRojaRp**. Los miembros del staff te atenderán lo más rápido posible.")
                        .addFields(
                            { name: "Usuario", value: ownerId ? `<@${ownerId}>` : `${interaction.user}`, inline: false },
                            { name: "Categoría", value: categoriaTexto, inline: false },
                            { name: "Staff", value: `\`${interaction.user.tag}\``, inline: false },
                            { name: "Estado del ticket", value: "`El ticket está actualmente abierto`", inline: false }
                        )
                        .setColor("#ff0000")
                        .setThumbnail(IMAGEN_LOGO);

                    await mensajeConEmbed.edit({
                        content: ownerId ? `<@${ownerId}>` : ``,
                        embeds: [nuevoEmbed],
                        components: [buildTicketButtons()]
                    });
                }

                await interaction.editReply({
                    content: `Ticket asumido por ${interaction.user}`
                });

                return;
            }

            // ===== RENOMBRAR =====
            if (interaction.customId === "renombrar") {
                const modal = new ModalBuilder()
                    .setCustomId("modal_renombrar")
                    .setTitle("Renombrar canal");

                const nuevoNombre = new TextInputBuilder()
                    .setCustomId("nuevo_nombre")
                    .setLabel("Nuevo nombre del canal")
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder("ejemplo-reportes-jota")
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nuevoNombre)
                );

                return interaction.showModal(modal);
            }
        }

    } catch (error) {
        console.log("Error en interacción:", error);

        try {
            if (interaction.isRepliable()) {
                if (interaction.deferred) {
                    await interaction.editReply({
                        content: "Ocurrió un error al ejecutar esa acción."
                    });
                } else if (!interaction.replied) {
                    await interaction.reply({
                        content: "Ocurrió un error al ejecutar esa acción.",
                        ephemeral: true
                    });
                }
            }
        } catch (e) {
            console.log("Error respondiendo al error:", e);
        }
    }
});

client.login(TOKEN);
