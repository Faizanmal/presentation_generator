import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties?: {
    files?: Array<{ uri: string; type: string }>;
    category?: string;
    creators?: Array<{ address: string; share: number }>;
  };
}

interface CollectionConfig {
  name: string;
  symbol: string;
  description?: string;
  chainId: string;
  royaltyPercent: number;
  maxSupply?: number;
}

interface MintConfig {
  name: string;
  description?: string;
  imageUrl: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  price?: number;
}

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);

  // Supported blockchain networks
  private readonly supportedChains = {
    ethereum: {
      name: 'Ethereum',
      chainId: 1,
      rpcUrl: 'https://mainnet.infura.io/v3/',
      explorerUrl: 'https://etherscan.io',
      marketplaces: ['opensea', 'rarible'],
    },
    polygon: {
      name: 'Polygon',
      chainId: 137,
      rpcUrl: 'https://polygon-rpc.com',
      explorerUrl: 'https://polygonscan.com',
      marketplaces: ['opensea', 'rarible'],
    },
    sepolia: {
      name: 'Sepolia (Testnet)',
      chainId: 11155111,
      rpcUrl: 'https://sepolia.infura.io/v3/',
      explorerUrl: 'https://sepolia.etherscan.io',
      marketplaces: ['opensea-testnet'],
    },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create NFT collection
   */
  async createCollection(userId: string, config: CollectionConfig) {
    // Validate chain
    if (
      !this.supportedChains[config.chainId as keyof typeof this.supportedChains]
    ) {
      throw new BadRequestException('Unsupported blockchain network');
    }

    // Check for existing collection with same symbol
    const existing = await this.prisma.nFTCollection.findFirst({
      where: { userId, symbol: config.symbol },
    });

    if (existing) {
      throw new BadRequestException(
        'Collection with this symbol already exists',
      );
    }

    return this.prisma.nFTCollection.create({
      data: {
        userId,
        name: config.name,
        symbol: config.symbol,
        description: config.description,
        chainId: config.chainId,
        royaltyPercent: config.royaltyPercent,
        maxSupply: config.maxSupply,
        status: 'draft',
        metadata: {
          createdAt: new Date().toISOString(),
          supportedMarketplaces:
            this.supportedChains[
              config.chainId as keyof typeof this.supportedChains
            ].marketplaces,
        },
      },
    });
  }

  /**
   * Deploy collection to blockchain (simulated - in production use Web3/ethers.js)
   */
  async deployCollection(collectionId: string, userId: string) {
    const collection = await this.getCollection(collectionId, userId);

    if (collection.status !== 'draft') {
      throw new BadRequestException('Collection already deployed or deploying');
    }

    await this.prisma.nFTCollection.update({
      where: { id: collectionId },
      data: { status: 'deploying' },
    });

    try {
      // In production, you would:
      // 1. Connect to blockchain via Web3/ethers.js
      // 2. Deploy ERC-721/ERC-1155 smart contract
      // 3. Wait for transaction confirmation
      // 4. Store contract address

      // Simulated deployment
      const simulatedContractAddress = `0x${crypto.randomBytes(20).toString('hex')}`;

      await this.prisma.nFTCollection.update({
        where: { id: collectionId },
        data: {
          status: 'deployed',
          contractAddress: simulatedContractAddress,
        },
      });

      return this.getCollection(collectionId, userId);
    } catch (error) {
      await this.prisma.nFTCollection.update({
        where: { id: collectionId },
        data: { status: 'draft' },
      });
      throw error;
    }
  }

  /**
   * Mint NFT for a presentation or template
   */
  async mintNFT(
    userId: string,
    config: MintConfig & {
      collectionId?: string;
      projectId?: string;
      templateId?: string;
    },
  ) {
    // Verify ownership if project/template specified
    if (config.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: config.projectId },
      });
      if (!project || project.ownerId !== userId) {
        throw new BadRequestException('Project not found');
      }
    }

    // Check collection limits
    if (config.collectionId) {
      const collection = await this.getCollection(config.collectionId, userId);
      if (
        collection.maxSupply &&
        collection.mintedCount >= collection.maxSupply
      ) {
        throw new BadRequestException('Collection max supply reached');
      }
    }

    // Generate NFT metadata
    const metadata: NFTMetadata = {
      name: config.name,
      description: config.description || 'Presentation NFT',
      image: config.imageUrl,
      attributes: config.attributes || [
        { trait_type: 'Type', value: 'Presentation' },
        { trait_type: 'Created', value: new Date().toISOString() },
      ],
      properties: {
        category: 'presentation',
        creators: [{ address: 'creator_address', share: 100 }],
      },
    };

    // Create mint record
    const mint = await this.prisma.nFTMint.create({
      data: {
        collectionId: config.collectionId,
        userId,
        projectId: config.projectId,
        templateId: config.templateId,
        status: 'pending',
        price: config.price,
        chainId: 'ethereum',
        metadata: metadata as object,
      },
    });

    // Process minting (in production, this would be async)
    await this.processMint(mint.id);

    return this.getMint(mint.id, userId);
  }

  /**
   * Process NFT minting
   */
  private async processMint(mintId: string) {
    try {
      await this.prisma.nFTMint.update({
        where: { id: mintId },
        data: { status: 'minting' },
      });

      const mint = await this.prisma.nFTMint.findUnique({
        where: { id: mintId },
        include: { collection: true },
      });

      if (!mint) return;

      // In production, you would:
      // 1. Upload metadata to IPFS
      // 2. Call smart contract mint function
      // 3. Wait for transaction confirmation

      // Simulated minting
      const tokenId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const transactionHash = `0x${crypto.randomBytes(32).toString('hex')}`;
      const ipfsHash = `Qm${crypto
        .randomBytes(22)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')}`;

      await this.prisma.nFTMint.update({
        where: { id: mintId },
        data: {
          status: 'minted',
          tokenId,
          transactionHash,
          ipfsHash,
          mintedAt: new Date(),
          ownerAddress: 'owner_wallet_address',
        },
      });

      // Create initial ownership record
      await this.prisma.nFTOwnership.create({
        data: {
          nftId: mintId,
          ownerAddress: 'owner_wallet_address',
          price: mint.price,
          transactionHash,
        },
      });

      // Update collection minted count
      if (mint.collectionId) {
        await this.prisma.nFTCollection.update({
          where: { id: mint.collectionId },
          data: { mintedCount: { increment: 1 } },
        });
      }
    } catch (error) {
      this.logger.error(`Minting failed: ${mintId}`, error);
      await this.prisma.nFTMint.update({
        where: { id: mintId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Minting failed',
        },
      });
    }
  }

  /**
   * Transfer NFT ownership
   */
  async transferNFT(mintId: string, userId: string, toAddress: string) {
    const mint = await this.getMint(mintId, userId);

    if (mint.status !== 'minted') {
      throw new BadRequestException('NFT not minted');
    }

    // In production, you would execute blockchain transfer
    const transactionHash = `0x${crypto.randomBytes(32).toString('hex')}`;

    // Update current owner
    await this.prisma.nFTOwnership.updateMany({
      where: { nftId: mintId, isCurrentOwner: true },
      data: { isCurrentOwner: false },
    });

    // Create new ownership record
    await this.prisma.nFTOwnership.create({
      data: {
        nftId: mintId,
        ownerAddress: toAddress,
        transactionHash,
        previousOwner: mint.ownerAddress,
      },
    });

    // Update mint record
    return this.prisma.nFTMint.update({
      where: { id: mintId },
      data: { ownerAddress: toAddress },
    });
  }

  /**
   * Record royalty payment
   */
  async recordRoyalty(
    mintId: string,
    creatorAddress: string,
    amount: number,
    transactionHash?: string,
  ) {
    return this.prisma.nFTRoyalty.create({
      data: {
        nftId: mintId,
        creatorAddress,
        amount,
        transactionHash,
      },
    });
  }

  /**
   * Get NFT pricing suggestion
   */
  getSuggestedPricing(
    slideCount: number,
    hasCustomDesign: boolean,
    isPremium: boolean,
  ): number {
    let basePrice = 0.01; // ETH

    // Adjust for slide count
    basePrice += slideCount * 0.001;

    // Adjust for custom design
    if (hasCustomDesign) {
      basePrice *= 1.5;
    }

    // Adjust for premium tier
    if (isPremium) {
      basePrice *= 2;
    }

    return Math.round(basePrice * 1000) / 1000;
  }

  /**
   * Generate OpenSea-compatible metadata
   */
  generateMarketplaceMetadata(mint: {
    metadata: unknown;
    tokenId?: string | null;
    collection?: { name: string; contractAddress?: string | null } | null;
  }): object {
    const metadata = mint.metadata as NFTMetadata;

    return {
      ...metadata,
      tokenId: mint.tokenId,
      collection: mint.collection?.name,
      contractAddress: mint.collection?.contractAddress,
      marketplace_urls: {
        opensea: mint.collection?.contractAddress
          ? `https://opensea.io/assets/ethereum/${mint.collection.contractAddress}/${mint.tokenId}`
          : null,
        rarible: mint.collection?.contractAddress
          ? `https://rarible.com/token/${mint.collection.contractAddress}:${mint.tokenId}`
          : null,
      },
    };
  }

  /**
   * Get collection by ID
   */
  async getCollection(id: string, userId: string) {
    const collection = await this.prisma.nFTCollection.findUnique({
      where: { id },
      include: {
        nfts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!collection || collection.userId !== userId) {
      throw new BadRequestException('Collection not found');
    }

    return collection;
  }

  /**
   * Get user's collections
   */
  async getUserCollections(userId: string) {
    return this.prisma.nFTCollection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { nfts: true },
        },
      },
    });
  }

  /**
   * Get mint by ID
   */
  async getMint(id: string, userId: string) {
    const mint = await this.prisma.nFTMint.findUnique({
      where: { id },
      include: {
        collection: true,
        ownership: { orderBy: { acquiredAt: 'desc' }, take: 5 },
        royalties: { orderBy: { paidAt: 'desc' }, take: 5 },
      },
    });

    if (!mint || mint.userId !== userId) {
      throw new BadRequestException('NFT not found');
    }

    return mint;
  }

  /**
   * Get user's minted NFTs
   */
  async getUserMints(userId: string, status?: string) {
    return this.prisma.nFTMint.findMany({
      where: {
        userId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
      include: { collection: true },
    });
  }

  /**
   * Get NFT ownership history
   */
  async getOwnershipHistory(mintId: string) {
    return this.prisma.nFTOwnership.findMany({
      where: { nftId: mintId },
      orderBy: { acquiredAt: 'desc' },
    });
  }

  /**
   * Get creator royalties
   */
  async getCreatorRoyalties(userId: string) {
    const mints = await this.prisma.nFTMint.findMany({
      where: { userId },
      select: { id: true },
    });

    const mintIds = mints.map((m) => m.id);

    const royalties = await this.prisma.nFTRoyalty.findMany({
      where: { nftId: { in: mintIds } },
      orderBy: { paidAt: 'desc' },
    });

    const totalRoyalties = royalties.reduce((sum, r) => sum + r.amount, 0);

    return {
      royalties,
      totalEarned: totalRoyalties,
      count: royalties.length,
    };
  }

  /**
   * Delete collection (only if no NFTs minted)
   */
  async deleteCollection(id: string, userId: string) {
    const collection = await this.getCollection(id, userId);

    if (collection.mintedCount > 0) {
      throw new BadRequestException(
        'Cannot delete collection with minted NFTs',
      );
    }

    return this.prisma.nFTCollection.delete({ where: { id } });
  }
}
