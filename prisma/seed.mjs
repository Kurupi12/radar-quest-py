import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[RadarQuest] Sembrando datos iniciales en PostgreSQL...");

  const vapeClub = await prisma.brand.upsert({
    where: { slug: "el-vape-club" },
    update: { logoEmoji: "vape" },
    create: {
      id: "brand_el_vape_club",
      slug: "el-vape-club",
      name: "El Vape Club",
      tagline: "Caza el Drop Urbano • Edición Oficial +18 Paraguay",
      logoEmoji: "vape",
      primaryColor: "#a855f7",
      secondaryColor: "#00f0ff",
      whatsapp: "+595981555420",
      requireAdult18: true,
      missionCredits: 12,
      cityDefault: "Encarnación",
      adminPin: "420420",
      active: true,
    },
  });

  const arcadeBurger = await prisma.brand.upsert({
    where: { slug: "arcade-burger" },
    update: { logoEmoji: "burger" },
    create: {
      id: "brand_arcade_burger",
      slug: "arcade-burger",
      name: "Arcade Burger PY",
      tagline: "Encontrá el Ticket Dorado en tu Ciudad • 16-Bit Burgers",
      logoEmoji: "burger",
      primaryColor: "#f97316",
      secondaryColor: "#facc15",
      whatsapp: "+595982444777",
      requireAdult18: false,
      missionCredits: 8,
      cityDefault: "Asunción",
      adminPin: "161616",
      active: true,
    },
  });

  const demoMissions = [
    {
      id: "msn_evc_enc_costanera",
      brandId: vapeClub.id,
      title: "Drop Nocturno: Costanera San José",
      city: "Encarnación",
      zoneHint:
        "Frente a la brisa del Paraná, cerca del Paseo Gastronómico y el histórico Molino. Seguí el pulso térmico.",
      secretLat: -27.3308,
      secretLng: -55.8669,
      publicCenterLat: -27.3324,
      publicCenterLng: -55.8682,
      qrToken: "EVC-ENC-SANJOSE-2026",
      nodeCode: "RQ-NODE-ENC-01",
      prizeTitle: "Pod Edición Limitada 15K Puffs + Hoodie El Vape Club",
      consolationTitle: "Cupón Explorador Curioso: 20% OFF en tienda",
    },
    {
      id: "msn_evc_enc_plaza",
      brandId: vapeClub.id,
      title: "Cápsula Neón: Plaza de Armas",
      city: "Encarnación",
      zoneHint:
        "En el corazón verde de la Perla del Sur, entre senderos arbolados y luces urbanas.",
      secretLat: -27.3372,
      secretLng: -55.8661,
      publicCenterLat: -27.3389,
      publicCenterLng: -55.8648,
      qrToken: "EVC-ENC-PLAZA-2026",
      nodeCode: "RQ-NODE-ENC-02",
      prizeTitle: "Kit VIP Vape Club + Mystery Box Neón",
      consolationTitle: "Cupón Explorador Curioso: 15% OFF en recargas",
    },
    {
      id: "msn_evc_asu_palma",
      brandId: vapeClub.id,
      title: "Bóveda Arcade: Calle Palma",
      city: "Asunción",
      zoneHint:
        "Donde late el centro histórico capitalino, a pasos de las banderas y fachadas clásicas.",
      secretLat: -25.2821,
      secretLng: -57.6352,
      publicCenterLat: -25.2837,
      publicCenterLng: -57.6368,
      qrToken: "EVC-ASU-PALMA-2026",
      nodeCode: "RQ-NODE-ASU-01",
      prizeTitle: "Combo Dual Device + Acceso VIP Lanzamiento Asunción",
      consolationTitle: "Cupón Explorador Curioso: 20% OFF Sucursal Centro",
    },
    {
      id: "msn_evc_asu_morra",
      brandId: vapeClub.id,
      title: "Reliquia Vapor: Zona Villa Morra",
      city: "Asunción",
      zoneHint:
        "Entre cafés nocturnos y pasajes peatonales de Villa Morra. Estacioná antes de los últimos 100 metros.",
      secretLat: -25.2846,
      secretLng: -57.5632,
      publicCenterLat: -25.2862,
      publicCenterLng: -57.5649,
      qrToken: "EVC-ASU-MORRA-2026",
      nodeCode: "RQ-NODE-ASU-02",
      prizeTitle: "Pack Aniversario El Vape Club + Gift Card Gs. 500.000",
      consolationTitle: "Cupón Explorador Curioso: 15% OFF Villa Morra",
    },
    {
      id: "msn_ab_asu_costanera",
      brandId: arcadeBurger.id,
      title: "Ticket Dorado: Costanera de Asunción",
      city: "Asunción",
      zoneHint:
        "Mirando a la bahía al atardecer, cerca del alquiler de kartings y bicis.",
      secretLat: -25.2768,
      secretLng: -57.6311,
      publicCenterLat: -25.2784,
      publicCenterLng: -57.6326,
      qrToken: "AB-ASU-BAHIA-2026",
      nodeCode: "RQ-NODE-AB-01",
      prizeTitle: "1 Mes de Smash Burgers Gratis + Gorra Pixel Art",
      consolationTitle: "Cupón Explorador Curioso: Papas Cheddar Gratis",
    },
  ];

  for (const m of demoMissions) {
    await prisma.mission.upsert({
      where: { id: m.id },
      update: {},
      create: m,
    });

    if (m.nodeCode) {
      await prisma.reusableQrNode.upsert({
        where: { code: m.nodeCode },
        update: { assignedMissionId: m.id },
        create: {
          code: m.nodeCode,
          label: `Nodo QR Físico ${m.nodeCode} (${m.city})`,
          brandId: m.brandId,
          assignedMissionId: m.id,
          active: true,
        },
      });
    }
  }

  console.log("[RadarQuest] Seed completado en PostgreSQL.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

