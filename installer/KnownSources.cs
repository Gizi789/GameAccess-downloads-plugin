namespace GameAccessPluginInstaller;

public record CommunitySource(string Id, string Name, string Url, string Description, string Type);

public static class KnownSources
{
    public static readonly IReadOnlyList<CommunitySource> List = new List<CommunitySource>
    {
        // Ready-to-play releases only: repacks with long installers (FitGirl, DODI and the like) are left out,
        // they take much longer to process and to bring into the library.
        new("steamrip", "SteamRIP", "https://hydralinks.cloud/sources/steamrip.json", "Pre-installed games with direct downloads", "Direct Download"),
        new("onlinefix", "Online-Fix", "https://hydralinks.cloud/sources/onlinefix.json", "Multiplayer fixes & online co-op releases", "Online Fixes / Torrent"),
        new("steamgg", "SteamGG", "https://wkeynhk.online/steamgg.json", "Clean Steam files & pre-installed releases", "Direct Download"),
        new("gog", "GOG Games", "https://hydralinks.cloud/sources/gog.json", "DRM-free GOG installers & extras", "DRM-Free / Direct"),
        new("pcgames", "PC Games", "https://stupidlysimpletextshare.quest/77ae94fb09/pcgames.json", "Community list of PC games", "Direct Download"),
    };
}
