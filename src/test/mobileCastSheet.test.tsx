import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const castMock: any = {};
vi.mock("@/contexts/CastContext", () => ({ useCast: () => castMock }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const scannerProps: any = {};
vi.mock("@/components/mobile/MobileQRScanner", () => ({
  MobileQRScanner: (p: any) => { Object.assign(scannerProps, p); return null; },
}));

import { MobileCastSheet } from "@/components/mobile/MobileCastSheet";

const URL_ = "https://cdn.hoyeeh.com/v.mp4";
function reset() {
  for (const k of Object.keys(castMock)) delete castMock[k];
  Object.assign(castMock, {
    isConnected: false, connectedDevice: null, sessionId: null, pairedDevices: [],
    playbackState: { videoUrl: null, videoTitle: null, isPlaying: false },
    pairWithCode: vi.fn(async () => "sess-1"),
    reconnectToDevice: vi.fn(async () => true),
    loadVideo: vi.fn(async () => ({ success: true, acked: true })),
    disconnect: vi.fn(),
  });
}
const renderSheet = (p: any = {}) =>
  render(<MobileCastSheet open onClose={p.onClose ?? vi.fn()} videoUrl={URL_} videoTitle="Film" currentTime={120} duration={3600} {...p} />);
const typeCode = (c: string) => fireEvent.change(screen.getByLabelText("TV code"), { target: { value: c } });

describe("MobileCastSheet (TV-code only)", () => {
  beforeEach(reset);

  it("is a titled modal with only the TV-code path (no other transports/tabs)", () => {
    renderSheet();
    expect(screen.getByRole("dialog", { name: /Cast to TV/ })).toBeTruthy();
    expect(screen.getByText("hoyeeh.com/tv")).toBeTruthy();
    for (const t of [/Quick Cast/i, /Smart TV/i, /DLNA/i, /Recent/i, /Chromecast/i, /AirPlay/i, /Remote Playback/i]) {
      expect(screen.queryByText(t)).toBeNull();
    }
    expect(screen.queryByRole("tab")).toBeNull();
    expect(document.querySelector("svg rect[data-qr]")).toBeNull();
  });

  it("pair -> LOAD with current media, onCastStart/close only after the ACK", async () => {
    let resolveLoad: (v: any) => void = () => {};
    castMock.loadVideo = vi.fn(() => new Promise((r) => { resolveLoad = r; }));
    const onCastStart = vi.fn(); const onClose = vi.fn();
    renderSheet({ onCastStart, onClose, thumbnail: "https://img/t.jpg" });
    typeCode("ab-c12 3");
    fireEvent.click(screen.getByRole("button", { name: /Connect & play/ }));
    await waitFor(() => expect(castMock.loadVideo).toHaveBeenCalledWith(URL_, "Film", "https://img/t.jpg", 3600, 120, "sess-1"));
    expect(castMock.pairWithCode).toHaveBeenCalledWith("ABC123");
    // double submit ignored while in flight
    fireEvent.submit(screen.getByLabelText("TV code").closest("form")!);
    expect(castMock.pairWithCode).toHaveBeenCalledTimes(1);
    expect(onCastStart).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    resolveLoad({ success: true, acked: true });
    await waitFor(() => expect(onCastStart).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("failed LOAD keeps sheet open, shows reason, never starts casting", async () => {
    castMock.loadVideo = vi.fn(async () => ({ success: false, timedOut: true, error: "TV did not confirm playback in time" }));
    const onCastStart = vi.fn(); const onClose = vi.fn();
    renderSheet({ onCastStart, onClose });
    typeCode("ABC123");
    fireEvent.click(screen.getByRole("button", { name: /Connect & play/ }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "TV did not confirm playback in time");
    expect(onCastStart).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it("bad code shows inline error and never loads", async () => {
    castMock.pairWithCode = vi.fn(async () => null);
    renderSheet();
    typeCode("ZZZ999");
    fireEvent.click(screen.getByRole("button", { name: /Connect & play/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(castMock.loadVideo).not.toHaveBeenCalled();
  });

  it("scanner gets false when pairing works but LOAD fails", async () => {
    castMock.loadVideo = vi.fn(async () => ({ success: false, error: "Unsupported video" }));
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /Scan TV QR/ }));
    await waitFor(() => expect(scannerProps.open).toBe(true));
    await expect(scannerProps.onCodeScanned("QRC0DE")).resolves.toBe(false);
    expect(castMock.pairWithCode).toHaveBeenCalledWith("QRC0DE");
  });

  it("paired TV reconnect uses its owner-scoped sessionId and waits for ACK", async () => {
    castMock.pairedDevices = [{ id: "rcv-1", name: "Bedroom TV", type: "remote", sessionId: "sess-9" }];
    const onCastStart = vi.fn();
    renderSheet({ onCastStart });
    fireEvent.click(screen.getByRole("button", { name: "Reconnect to Bedroom TV" }));
    await waitFor(() => expect(onCastStart).toHaveBeenCalled());
    expect(castMock.reconnectToDevice).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "sess-9" }));
    expect(castMock.loadVideo).toHaveBeenCalledWith(URL_, "Film", undefined, 3600, 120, "sess-9");
  });

  it("expired reconnect asks for a new code and does not load", async () => {
    castMock.pairedDevices = [{ id: "rcv-1", name: "Bedroom TV", type: "remote", sessionId: "old" }];
    castMock.reconnectToDevice = vi.fn(async () => false);
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Reconnect to Bedroom TV" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/expired/);
    expect(castMock.loadVideo).not.toHaveBeenCalled();
  });

  it("no paired row without a sessionId", () => {
    castMock.pairedDevices = [{ id: "x", name: "Old TV", type: "remote" }];
    renderSheet();
    expect(screen.queryByText("Paired TV")).toBeNull();
  });

  it("connected state shows TV name, status and Disconnect", () => {
    Object.assign(castMock, { isConnected: true, sessionId: "s", connectedDevice: { id: "r", name: "Living Room", type: "remote" },
      playbackState: { videoUrl: URL_, videoTitle: "Film", isPlaying: true } });
    renderSheet({ videoUrl: "" });
    expect(screen.getByText("Living Room")).toBeTruthy();
    expect(screen.getByText("Playing: Film")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Disconnect/ }));
    expect(castMock.disconnect).toHaveBeenCalled();
  });

  it("device-management mode pairs without loading", async () => {
    const onClose = vi.fn();
    renderSheet({ videoUrl: "", onClose });
    typeCode("ABC123");
    fireEvent.click(screen.getByRole("button", { name: /^Connect$/ }));
    await waitFor(() => expect(castMock.pairWithCode).toHaveBeenCalled());
    expect(castMock.loadVideo).not.toHaveBeenCalled();
  });
});
