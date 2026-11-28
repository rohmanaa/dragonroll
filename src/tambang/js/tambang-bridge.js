/* Dompet server: segarkan saldo & sinkron berkala (sama seperti halaman lain). Hanya akun login. */
document.addEventListener('DOMContentLoaded', function () {
  try {
    var PD = window.PlayerData, W = window.UT && UT.WalletService && UT.WalletService.get && UT.WalletService.get();
    if (!(PD && PD.serverMode && PD.serverMode() && W)) return;
    W.refresh();
    if (UT.LiveSync) {
      var LS = UT.LiveSync; LS.add('wallet', function () { return W.refresh(); }); LS.start({ interval: 20000 });
      window.addEventListener('pagehide', function () { LS.remove('wallet'); LS.stop(); });
    }
  } catch (e) { }
});
