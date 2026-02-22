import { PrismaClient, BlockType } from '@prisma/client';

/**
 * Script to fix bullet list blocks in the database
 * Converts old format { text: "..." } to new format { items: [...] }
 */
async function fixBulletLists() {
  const prisma = new PrismaClient();
  console.log('Starting bullet list fix...');

  try {
    // Get all BULLET_LIST and NUMBERED_LIST blocks
    const blocks = await prisma.block.findMany({
      where: {
        OR: [
          { blockType: BlockType.BULLET_LIST },
          { blockType: BlockType.NUMBERED_LIST },
        ],
      },
      orderBy: [{ slideId: 'asc' }, { order: 'asc' }],
    });

    console.log(`Found ${blocks.length} list blocks to check`);

    let fixedCount = 0;
    const blocksBySlide = new Map<string, typeof blocks>();

    // Group blocks by slide
    for (const block of blocks) {
      if (!block.slideId) continue;

      const slideBlocks = blocksBySlide.get(block.slideId) || [];
      slideBlocks.push(block);
      blocksBySlide.set(block.slideId, slideBlocks);
    }

    // Process each slide
    for (const [slideId, slideBlocks] of blocksBySlide.entries()) {
      console.log(
        `Processing slide ${slideId} with ${slideBlocks.length} list blocks`,
      );

      // Group consecutive list blocks of the same type
      let i = 0;
      while (i < slideBlocks.length) {
        const currentBlock = slideBlocks[i];
        const content = currentBlock.content as Record<string, unknown>;

        // Skip if already has items array
        if (content?.items && Array.isArray(content.items)) {
          i++;
          continue;
        }

        // If it has text instead of items, it needs fixing
        if (content?.text) {
          // Collect consecutive blocks of same type
          const items: string[] = [];
          const blockType = currentBlock.blockType;
          const blocksToDelete: string[] = [];
          let j = i;

          while (
            j < slideBlocks.length &&
            slideBlocks[j].blockType === blockType
          ) {
            const blockContent = slideBlocks[j].content as Record<string, unknown>;
            if (blockContent?.text) {
              items.push(blockContent.text);
              if (j > i) {
                blocksToDelete.push(slideBlocks[j].id);
              }
            }
            j++;
          }

          // Update the first block with items array
          await prisma.block.update({
            where: { id: currentBlock.id },
            data: {
              content: { items },
            },
          });

          // Delete the duplicate blocks
          if (blocksToDelete.length > 0) {
            await prisma.block.deleteMany({
              where: {
                id: { in: blocksToDelete },
              },
            });
            console.log(`  Merged ${blocksToDelete.length + 1} blocks into 1`);
          }

          fixedCount++;
          i = j;
        } else {
          i++;
        }
      }
    }

    console.log(`✅ Fixed ${fixedCount} list blocks`);
  } catch (error) {
    console.error('❌ Error fixing bullet lists:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixBulletLists()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
