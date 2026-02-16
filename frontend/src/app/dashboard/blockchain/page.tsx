'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Coins, Plus, Loader2, ArrowLeft, ShieldCheck, ExternalLink, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useNFTCollections } from '@/hooks/use-new-features';
import Link from 'next/link';

export default function BlockchainPage() {
  const { collections, isLoading, createCollection, mintNFT } = useNFTCollections();
  const [name, setName] = useState('');
  const [chain, setChain] = useState('polygon');
  const [description, setDescription] = useState('');
  const [mintOpen, setMintOpen] = useState(false);
  const [mintCollectionId, setMintCollectionId] = useState('');
  const [mintName, setMintName] = useState('');
  const [mintPresentationId, setMintPresentationId] = useState('');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Coins className="w-8 h-8 text-primary" />
              Blockchain &amp; NFT
            </h1>
            <p className="text-muted-foreground mt-1">
              Mint presentations as NFTs for digital ownership verification
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create NFT Collection</CardTitle>
            <CardDescription>Set up a collection to mint your presentations as NFTs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Collection name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="flex gap-3">
              <Select value={chain} onValueChange={setChain}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ethereum">Ethereum</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                  <SelectItem value="sepolia">Sepolia (Test)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="flex-1"
                onClick={() => {
                  createCollection.mutate({ name, chain, description }, {
                    onSuccess: () => { toast.success('Collection created!'); setName(''); setDescription(''); },
                    onError: () => toast.error('Failed to create collection'),
                  });
                }}
                disabled={createCollection.isPending || !name.trim()}
              >
                {createCollection.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Collection
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Mint Dialog */}
        <Dialog open={mintOpen} onOpenChange={setMintOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mint NFT</DialogTitle>
              <DialogDescription>Turn your presentation into a blockchain-verified NFT</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="NFT name" value={mintName} onChange={(e) => setMintName(e.target.value)} />
              <Input placeholder="Presentation ID" value={mintPresentationId} onChange={(e) => setMintPresentationId(e.target.value)} />
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  mintNFT.mutate({
                    collectionId: mintCollectionId,
                    input: { presentationId: mintPresentationId, name: mintName },
                  }, {
                    onSuccess: () => { toast.success('NFT minted!'); setMintOpen(false); },
                    onError: () => toast.error('Minting failed'),
                  });
                }}
                disabled={mintNFT.isPending}
              >
                {mintNFT.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Coins className="w-4 h-4 mr-2" />}
                Mint NFT
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Collections</h2>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
          ) : collections?.length ? (
            collections.map((col: { id: string; name: string; chain: string; status: string; contractAddress?: string; nfts: { id: string; name: string; status: string; tokenId?: string }[] }) => (
              <Card key={col.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{col.name}</h3>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline"><Wallet className="w-3 h-3 mr-1" />{col.chain}</Badge>
                        <Badge>{col.status}</Badge>
                      </div>
                      {col.contractAddress && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{col.contractAddress}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => { setMintCollectionId(col.id); setMintOpen(true); }}
                    >
                      <Coins className="w-3 h-3 mr-1" /> Mint
                    </Button>
                  </div>
                  {col.nfts?.length > 0 && (
                    <div className="space-y-2">
                      {col.nfts.map(nft => (
                        <div key={nft.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <span className="text-sm">{nft.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">{nft.status}</Badge>
                            {nft.tokenId && <ShieldCheck className="w-4 h-4 text-green-500" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <Coins className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No collections yet.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
