import Foundation
import AVFAudio
import Capacitor

@objc(AyahAudioFocusPlugin)
public class AyahAudioFocusPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AyahAudioFocusPlugin"
    public let jsName = "AyahAudioFocus"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestFocus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "releaseFocus", returnType: CAPPluginReturnPromise)
    ]
    private var observations: [NSObjectProtocol] = []
    public override func load() {
        let center = NotificationCenter.default
        observations.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] event in
            guard let kind = event.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  kind == AVAudioSession.InterruptionType.began.rawValue else { return }
            self?.notifyListeners("interruption", data: ["interrupted": true])
        })
        observations.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] event in
            guard let reason = event.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
                  reason == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue else { return }
            self?.notifyListeners("interruption", data: ["interrupted": true])
        })
    }
    // WKWebView owns its playback/recording category; changing it here can break the microphone.
    @objc func requestFocus(_ call: CAPPluginCall) { call.resolve(["granted": true]) }
    @objc func releaseFocus(_ call: CAPPluginCall) { call.resolve() }
    deinit { for observation in observations { NotificationCenter.default.removeObserver(observation) } }
}

class AyahBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(AyahAudioFocusPlugin()) }
}
