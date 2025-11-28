import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test user
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { username: 'testuser' },
    update: {},
    create: {
      username: 'testuser',
      password: hashedPassword,
    },
  });

  console.log('✅ Created test user:', user.username);

  // Create sample characters
  const characters = [
    {
      characterName: 'Special Week',
      identifierVersion: 'Speed Focus v1',
      notes: 'Entrenamiento enfocado en velocidad y resistencia',
    },
    {
      characterName: 'Silence Suzuka',
      identifierVersion: 'Stamina Build v1',
      notes: 'Build para distancias largas',
    },
    {
      characterName: 'Tokai Teio',
      identifierVersion: 'Balanced v1',
      notes: 'Stats equilibrados para todas las pistas',
    },
  ];

  for (const char of characters) {
    await prisma.characterTraining.create({
      data: {
        ...char,
        userId: user.id,
      },
    });
  }

  console.log('✅ Created sample characters');
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
