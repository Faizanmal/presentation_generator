import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BlockchainService } from './blockchain.service';

class CreateCollectionDto {
  name: string;
  symbol: string;
  description?: string;
  chainId?: string;
  royaltyPercent?: number;
  maxSupply?: number;
}

class MintNFTDto {
  name: string;
  description?: string;
  imageUrl: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  price?: number;
  collectionId?: string;
  projectId?: string;
  templateId?: string;
}

class TransferNFTDto {
  toAddress: string;
}

@ApiTags('Blockchain/NFT')
@Controller('blockchain')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  // Collections
  @Post('collections')
  @ApiOperation({ summary: 'Create NFT collection' })
  async createCollection(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateCollectionDto,
  ) {
    return this.blockchainService.createCollection(req.user.id, {
      ...dto,
      chainId: dto.chainId || 'ethereum',
      royaltyPercent: dto.royaltyPercent || 2.5,
    });
  }

  @Get('collections')
  @ApiOperation({ summary: 'Get user collections' })
  async getUserCollections(@Request() req: { user: { id: string } }) {
    return this.blockchainService.getUserCollections(req.user.id);
  }

  @Get('collections/:id')
  @ApiOperation({ summary: 'Get collection by ID' })
  async getCollection(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.blockchainService.getCollection(id, req.user.id);
  }

  @Post('collections/:id/deploy')
  @ApiOperation({ summary: 'Deploy collection to blockchain' })
  async deployCollection(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.blockchainService.deployCollection(id, req.user.id);
  }

  @Delete('collections/:id')
  @ApiOperation({ summary: 'Delete collection' })
  async deleteCollection(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.blockchainService.deleteCollection(id, req.user.id);
  }

  // NFT Minting
  @Post('mint')
  @ApiOperation({ summary: 'Mint NFT' })
  async mintNFT(
    @Request() req: { user: { id: string } },
    @Body() dto: MintNFTDto,
  ) {
    return this.blockchainService.mintNFT(req.user.id, dto);
  }

  @Get('mints')
  @ApiOperation({ summary: 'Get user minted NFTs' })
  async getUserMints(
    @Request() req: { user: { id: string } },
    @Query('status') status?: string,
  ) {
    return this.blockchainService.getUserMints(req.user.id, status);
  }

  @Get('mints/:id')
  @ApiOperation({ summary: 'Get mint by ID' })
  async getMint(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.blockchainService.getMint(id, req.user.id);
  }

  @Get('mints/:id/metadata')
  @ApiOperation({ summary: 'Get marketplace metadata' })
  async getMarketplaceMetadata(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    const mint = await this.blockchainService.getMint(id, req.user.id);
    return this.blockchainService.generateMarketplaceMetadata(mint);
  }

  @Post('mints/:id/transfer')
  @ApiOperation({ summary: 'Transfer NFT' })
  async transferNFT(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: TransferNFTDto,
  ) {
    return this.blockchainService.transferNFT(id, req.user.id, dto.toAddress);
  }

  @Get('mints/:id/ownership-history')
  @ApiOperation({ summary: 'Get ownership history' })
  async getOwnershipHistory(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    await this.blockchainService.getMint(id, req.user.id);
    return this.blockchainService.getOwnershipHistory(id);
  }

  // Royalties
  @Get('royalties')
  @ApiOperation({ summary: 'Get creator royalties' })
  async getCreatorRoyalties(@Request() req: { user: { id: string } }) {
    return this.blockchainService.getCreatorRoyalties(req.user.id);
  }

  // Utilities
  @Get('pricing-suggestion')
  @ApiOperation({ summary: 'Get suggested NFT pricing' })
  getPricingSuggestion(
    @Query('slideCount') slideCount: string,
    @Query('hasCustomDesign') hasCustomDesign: string,
    @Query('isPremium') isPremium: string,
  ) {
    return {
      suggestedPrice: this.blockchainService.getSuggestedPricing(
        parseInt(slideCount, 10) || 10,
        hasCustomDesign === 'true',
        isPremium === 'true',
      ),
      currency: 'ETH',
    };
  }
}
