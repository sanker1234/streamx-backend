import { registry } from "./providerRegistry.js";
import { MetadataProvider } from "./base/MetadataProvider.js";
import * as anilistProvider from "./anilistProvider.js";
import { AnikotoEpisodeProvider } from "./anikotoProvider.js";
import { NineAnimeScraperProvider } from "./nineAnimeProvider.js";
import { AniwavesEpisodeProvider } from "./aniwavesProvider.js";
import { ConsumetEpisodeProvider } from "./consumetProvider.js";
import { MegaVidProvider } from "./megavidProvider.js";
import { VidCloudProvider } from "./vidcloudProvider.js";
import { ZokoAnimeProvider } from "./zokoanimeProvider.js";
import { AniXoProvider } from "./anixoProvider.js";
import { VidNestProvider } from "./vidnestProvider.js";
import { AniLinkProvider } from "./anilinkProvider.js";
import { VidSyncProvider } from "./vidsyncProvider.js";
import { AniEmbedProvider } from "./aniembedProvider.js";
// Reader registry — imported here so it is instantiated once at startup.
// No providers are registered in Phase 1; they will be added in Phase 2+.
import { readerRegistry, startReaderHealthChecks } from "./readerProviderRegistry.js"; // eslint-disable-line no-unused-vars


class AniListMetadataProvider extends MetadataProvider {
  constructor() {
    super("anime");
  }

  async fetchList(opts) {
    return anilistProvider.fetchList(opts);
  }

  async fetchDetails(id, mediaType) {
    return anilistProvider.fetchDetails(id, mediaType);
  }

  async fetchSearch(query, page) {
    return anilistProvider.fetchSearch(query, page);
  }
}

// Register AniList as the default anime metadata provider
registry.register(new AniListMetadataProvider());

// Register Anikoto as the default episodes provider (Server 1)
registry.register(new AnikotoEpisodeProvider("anikoto"));

// Register positive verified providers for StreamX architecture
registry.register(new MegaVidProvider(), "episodes");
registry.register(new VidCloudProvider(), "episodes");
registry.register(new ZokoAnimeProvider(), "episodes");
registry.register(new AniXoProvider(), "episodes");
registry.register(new VidNestProvider(), "episodes");
registry.register(new VidSyncProvider(), "episodes");
registry.register(new AniLinkProvider(), "episodes");
registry.register(new AniEmbedProvider(), "episodes");
import { VidBoltAnimeProvider, VidBoltStreamingProvider } from "./vidboltProvider.js";
import { VidemProvider } from "./videmProvider.js";
import { CodeSpectersProvider } from "./codespectersProvider.js";
import { StreamFlizoProvider } from "./streamflizoProvider.js";
registry.register(new VidBoltAnimeProvider(), "episodes");

// Register custom scrapers
registry.register(new NineAnimeScraperProvider("nineanime"));
registry.register(new AniwavesEpisodeProvider("aniwaves"));
registry.register(new ConsumetEpisodeProvider("consumet"));

// ── Movie, TV & Anime Streaming Providers ──────────────────────────────────
import { NetMirrorProvider } from "./netMirrorProvider.js";
import { SmashyStreamProvider } from "./smashyStreamProvider.js";
import { TwoEmbedProvider, VidLinkStreamingProvider } from "./vidlinkProvider.js";
import { CineSrcProvider } from "./cineSrcProvider.js";
import { FilmUProvider } from "./filmuProvider.js";
import { VidCoreProvider } from "./vidcoreProvider.js";
import { PeachifyProvider } from "./peachifyProvider.js";
import { VidSrcSbsProvider } from "./vidsrcSbsProvider.js";
import { EmbedMasterProvider } from "./embedMasterProvider.js";

registry.register(new VidBoltStreamingProvider());
registry.register(new VidemProvider());
registry.register(new CodeSpectersProvider());
registry.register(new StreamFlizoProvider());
registry.register(new NetMirrorProvider());
registry.register(new SmashyStreamProvider());
registry.register(new TwoEmbedProvider());
registry.register(new VidLinkStreamingProvider());
registry.register(new CineSrcProvider());
registry.register(new FilmUProvider());
registry.register(new VidCoreProvider());
registry.register(new PeachifyProvider());
registry.register(new VidSrcSbsProvider());
registry.register(new EmbedMasterProvider());