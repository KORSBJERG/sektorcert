import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  ArrowLeft,
  Palette,
  Wand2,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import UserMenu from "@/components/UserMenu";

type Customer = {
  id: string;
  name: string;
  website: string | null;
};

type ExtractResult = {
  url: string;
  title: string | null;
  description: string | null;
  logos: string[];
  colors: string[];
};

type AssetKey = "background" | "banner" | "square_light" | "square_dark" | "favicon";

const ASSET_INFO: Record<AssetKey, { label: string; size: string; description: string; filename: string }> = {
  background: {
    label: "Login baggrund",
    size: "1920×1080",
    description: "Stor baggrund til Microsoft 365 sign-in siden.",
    filename: "background-1920x1080.jpg",
  },
  banner: {
    label: "Banner logo",
    size: "280×60",
    description: "Vises øverst i sign-in dialogen. Transparent PNG.",
    filename: "banner-logo-280x60.png",
  },
  square_light: {
    label: "Firmamærke (lys)",
    size: "240×240",
    description: "Kvadratisk logo til lys baggrund.",
    filename: "square-logo-light-240x240.png",
  },
  square_dark: {
    label: "Firmamærke (mørk)",
    size: "240×240",
    description: "Kvadratisk logo til mørk baggrund.",
    filename: "square-logo-dark-240x240.png",
  },
  favicon: {
    label: "Favicon",
    size: "32×32",
    description: "Browser-fane ikon.",
    filename: "favicon-32x32.png",
  },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

async function fitImage(
  src: string,
  width: number,
  height: number,
  options: { background?: string | null; padding?: number; cover?: boolean; mime?: string; quality?: number } = {},
): Promise<string> {
  const { background = null, padding = 0, cover = false, mime = "image/png", quality = 0.92 } = options;
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const ratio = img.width / img.height;
  let dw: number;
  let dh: number;
  if (cover) {
    if (ratio > innerW / innerH) {
      dh = innerH;
      dw = dh * ratio;
    } else {
      dw = innerW;
      dh = dw / ratio;
    }
  } else {
    if (ratio > innerW / innerH) {
      dw = innerW;
      dh = dw / ratio;
    } else {
      dh = innerH;
      dw = dh * ratio;
    }
  }
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  return canvas.toDataURL(mime, quality);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const blob = dataUrlToBlob(dataUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function composeLoginBackground(
  bgSrc: string,
  options: {
    companyName: string;
    logoSrc?: string | null;
    accentColor?: string;
  },
): Promise<string> {
  const W = 1920;
  const H = 1080;
  const { companyName, logoSrc, accentColor = "#ffffff" } = options;
  const bg = await loadImage(bgSrc);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // cover-draw background
  const ratio = bg.width / bg.height;
  let dw: number, dh: number;
  if (ratio > W / H) {
    dh = H;
    dw = dh * ratio;
  } else {
    dw = W;
    dh = dw / ratio;
  }
  ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);

  // Left-side dark overlay for legibility (sign-in dialog sits on the right)
  const grad = ctx.createLinearGradient(0, 0, W * 0.7, 0);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const padX = 120;
  let cursorY = H / 2 - 60;

  // Logo (top of brand block)
  if (logoSrc) {
    try {
      const logo = await loadImage(logoSrc);
      const maxW = 360;
      const maxH = 180;
      const lr = logo.width / logo.height;
      let lw = maxW;
      let lh = lw / lr;
      if (lh > maxH) {
        lh = maxH;
        lw = lh * lr;
      }
      // soft shadow for contrast on any background
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 24;
      ctx.drawImage(logo, padX, cursorY - lh, lw, lh);
      ctx.restore();
      cursorY += 40;
    } catch (e) {
      console.warn("Could not draw logo on background", e);
    }
  }

  // Company name
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = accentColor;
  ctx.font = "700 84px 'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(companyName, padX, cursorY);
  ctx.restore();

  // Accent underline
  ctx.fillStyle = accentColor;
  ctx.fillRect(padX, cursorY + 110, 120, 6);

  return canvas.toDataURL("image/jpeg", 0.9);
}

const Branding = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [website, setWebsite] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");

  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractResult | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [chosenLogoIndex, setChosenLogoIndex] = useState(0);
  const [colors, setColors] = useState<string[]>([]);

  const [generatingBg, setGeneratingBg] = useState(false);
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(null);

  const [assets, setAssets] = useState<Partial<Record<AssetKey, string>>>({});
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, website")
        .order("name");
      setCustomers((data ?? []) as Customer[]);
    };
    load();
  }, []);

  const onPickCustomer = (id: string) => {
    setSelectedCustomer(id);
    const c = customers.find((x) => x.id === id);
    if (c) {
      if (c.website) setWebsite(c.website);
      if (c.name) setCompanyName(c.name);
    }
  };

  const fetchLogo = async (logoUrl: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("m365-branding-fetch-image", {
        body: { url: logoUrl },
      });
      if (error) throw error;
      return (data as { dataUrl?: string }).dataUrl ?? null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleExtract = async () => {
    if (!website.trim()) {
      toast.error("Indtast en hjemmeside");
      return;
    }
    setExtracting(true);
    setExtracted(null);
    setLogoDataUrl(null);
    setBgDataUrl(null);
    setAssets({});
    try {
      const { data, error } = await supabase.functions.invoke("m365-branding-extract", {
        body: { url: website },
      });
      if (error) throw error;
      const result = data as ExtractResult & { error?: string };
      if (result.error) throw new Error(result.error);
      setExtracted(result);
      setColors(result.colors ?? []);
      if (!companyName && result.title) setCompanyName(result.title.split("|")[0].trim());
      if (!description && result.description) setDescription(result.description);
      if (result.logos.length > 0) {
        const dataUrl = await fetchLogo(result.logos[0]);
        if (dataUrl) setLogoDataUrl(dataUrl);
      }
      toast.success("Brand-info hentet");
    } catch (e: any) {
      toast.error(e?.message ?? "Kunne ikke hente brand-info");
    } finally {
      setExtracting(false);
    }
  };

  const onChooseLogo = async (index: number) => {
    if (!extracted?.logos[index]) return;
    setChosenLogoIndex(index);
    setLogoDataUrl(null);
    const dataUrl = await fetchLogo(extracted.logos[index]);
    if (dataUrl) setLogoDataUrl(dataUrl);
    else toast.error("Kunne ikke hente det valgte logo");
  };

  const handleGenerateBackground = async () => {
    setGeneratingBg(true);
    try {
      const { data, error } = await supabase.functions.invoke("m365-branding-generate-bg", {
        body: {
          name: companyName,
          description,
          colors,
        },
      });
      if (error) throw error;
      const result = data as { image?: string; error?: string };
      if (result.error) throw new Error(result.error);
      if (!result.image) throw new Error("Intet billede returneret");
      // Resize/letterbox to 1920x1080 jpg
      const fitted = await fitImage(result.image, 1920, 1080, {
        background: "#0b1220",
        cover: true,
        mime: "image/jpeg",
        quality: 0.85,
      });
      setBgDataUrl(fitted);
      toast.success("Baggrund genereret");
    } catch (e: any) {
      toast.error(e?.message ?? "Kunne ikke generere baggrund");
    } finally {
      setGeneratingBg(false);
    }
  };

  const handleBuildAssets = async () => {
    if (!logoDataUrl && !bgDataUrl) {
      toast.error("Hent et logo eller generér en baggrund først");
      return;
    }
    setBuilding(true);
    const next: Partial<Record<AssetKey, string>> = {};
    try {
      if (bgDataUrl) {
        next.background = bgDataUrl;
      }
      if (logoDataUrl) {
        next.banner = await fitImage(logoDataUrl, 280, 60, { background: null, padding: 4 });
        next.square_light = await fitImage(logoDataUrl, 240, 240, {
          background: "#ffffff",
          padding: 24,
        });
        next.square_dark = await fitImage(logoDataUrl, 240, 240, {
          background: "#0b1220",
          padding: 24,
        });
        next.favicon = await fitImage(logoDataUrl, 32, 32, { background: null, padding: 0 });
      }
      setAssets(next);
      toast.success("Assets bygget");
    } catch (e: any) {
      toast.error("Kunne ikke bygge alle assets — tjek logo-format");
    } finally {
      setBuilding(false);
    }
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    let count = 0;
    for (const k of Object.keys(assets) as AssetKey[]) {
      const dataUrl = assets[k];
      if (!dataUrl) continue;
      const blob = dataUrlToBlob(dataUrl);
      const buf = await blob.arrayBuffer();
      zip.file(ASSET_INFO[k].filename, buf);
      count++;
    }
    if (!count) {
      toast.error("Ingen assets at downloade");
      return;
    }
    const readme = `Microsoft 365 Company Branding assets
Genereret: ${new Date().toISOString()}
Virksomhed: ${companyName || "—"}
Hjemmeside: ${website || "—"}

Filer:
${(Object.keys(assets) as AssetKey[])
  .filter((k) => assets[k])
  .map((k) => `- ${ASSET_INFO[k].filename}  (${ASSET_INFO[k].label}, ${ASSET_INFO[k].size})`)
  .join("\n")}

Upload disse i Microsoft Entra > Company branding.`;
    zip.file("README.txt", readme);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (companyName || "branding").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.href = url;
    a.download = `m365-branding-${safeName}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const canBuild = !!(logoDataUrl || bgDataUrl);
  const hasAssets = Object.values(assets).some(Boolean);

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="border-b border-border/50 bg-background/40 backdrop-blur">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Tilbage
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                M365 Branding Generator
              </h1>
              <p className="text-xs text-muted-foreground">
                Lav login-baggrund, logo og favicon til Microsoft Entra Company Branding
              </p>
            </div>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="container py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Hent kundens brand</CardTitle>
            <CardDescription>
              Vælg en kunde eller indtast hjemmeside. Vi henter logo og dominerende farver automatisk.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Kunde (valgfri)</Label>
                <Select value={selectedCustomer} onValueChange={onPickCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vælg kunde …" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hjemmeside</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="eksempel.dk"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                  <Button onClick={handleExtract} disabled={extracting}>
                    {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Virksomhedsnavn</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Beskrivelse (bruges af AI)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Kort om virksomheden — branche, tone …"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {extracted && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" /> Logo
                </CardTitle>
                <CardDescription>
                  {extracted.logos.length} kandidater fundet — vælg den bedste.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {logoDataUrl ? (
                  <div className="rounded-md border bg-[conic-gradient(at_top_left,_#1118,_#1114)] p-6 flex items-center justify-center min-h-32">
                    <img src={logoDataUrl} alt="logo" className="max-h-24 object-contain" />
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground text-center">
                    Henter logo …
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {extracted.logos.slice(0, 8).map((u, i) => (
                    <button
                      key={u}
                      onClick={() => onChooseLogo(i)}
                      className={`rounded border p-1 hover:border-primary transition ${
                        i === chosenLogoIndex ? "border-primary ring-2 ring-primary/40" : "border-border"
                      }`}
                      title={u}
                    >
                      <img src={u} alt="" className="h-10 w-16 object-contain bg-white/5" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" /> Farver
                </CardTitle>
                <CardDescription>Klik for at fjerne en farve fra paletten.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {colors.length === 0 && (
                    <p className="text-sm text-muted-foreground">Ingen farver fundet.</p>
                  )}
                  {colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColors(colors.filter((x) => x !== c))}
                      className="flex items-center gap-2 rounded-md border bg-background/40 px-2 py-1 text-xs hover:opacity-80"
                    >
                      <span
                        className="inline-block h-4 w-4 rounded"
                        style={{ backgroundColor: c }}
                      />
                      <span className="font-mono">{c}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="#0066ff"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = (e.target as HTMLInputElement).value.trim();
                        if (/^#[0-9a-f]{6}$/i.test(v)) {
                          setColors([...colors, v.toLowerCase()]);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {extracted && (
          <Card>
            <CardHeader>
              <CardTitle>2. Generér login-baggrund med AI</CardTitle>
              <CardDescription>
                AI bruger virksomhedens navn, beskrivelse og farver til en abstrakt baggrund (1920×1080).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleGenerateBackground} disabled={generatingBg}>
                {generatingBg ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                {bgDataUrl ? "Generér igen" : "Generér baggrund"}
              </Button>
              {bgDataUrl && (
                <div className="rounded-md overflow-hidden border">
                  <img src={bgDataUrl} alt="generated background" className="w-full" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {extracted && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>3. Byg M365 assets</CardTitle>
                  <CardDescription>Klar til upload i Microsoft Entra → Company branding.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleBuildAssets} disabled={!canBuild || building}>
                    {building ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Byg alle
                  </Button>
                  <Button variant="secondary" onClick={handleDownloadZip} disabled={!hasAssets}>
                    <Package className="h-4 w-4 mr-2" />
                    Download .zip
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(Object.keys(ASSET_INFO) as AssetKey[]).map((key) => {
                  const info = ASSET_INFO[key];
                  const dataUrl = assets[key];
                  const isWide = key === "background" || key === "banner";
                  return (
                    <div key={key} className="rounded-lg border bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{info.label}</p>
                          <p className="text-xs text-muted-foreground">{info.size}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {dataUrl ? "klar" : "—"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                      <div
                        className="rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden"
                        style={{ aspectRatio: isWide ? "16/9" : "1/1", maxHeight: 200 }}
                      >
                        {dataUrl ? (
                          <img
                            src={dataUrl}
                            alt={info.label}
                            className="max-h-full max-w-full object-contain"
                            style={
                              key === "square_dark"
                                ? { background: "#0b1220" }
                                : key === "square_light"
                                ? { background: "#ffffff" }
                                : undefined
                            }
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">Ingen preview</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={!dataUrl}
                        onClick={() => dataUrl && downloadDataUrl(dataUrl, info.filename)}
                      >
                        <Download className="h-4 w-4 mr-2" /> Download
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-xs text-muted-foreground">
          Tip: I Microsoft Entra åbner du{" "}
          <a
            href="https://entra.microsoft.com"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            entra.microsoft.com
          </a>{" "}
          → Company branding → og uploader filerne fra .zip’en.
        </div>
      </main>
    </div>
  );
};

export default Branding;