using GameHelper.Localization;

namespace Autopot
{
    /// <summary>Which vitals trigger Key 1 / Key 2 in simplified autopot logic.</summary>
    public enum LogicMode
    {
        ManaAndLife,
        LifeOnly,
        EnergyShield,
        HybridLifeEs,
        ManaOnly,
        ManaAndEs,
        LifeEsMana,
    }

    internal static class LogicModeLabels
    {
        public static string Display(LogicMode mode, PluginLocalization text) => mode switch
        {
            LogicMode.ManaAndLife => text.T("logic.mana_and_life", "Mana + Life"),
            LogicMode.LifeOnly => text.T("logic.life_only", "Life Only"),
            LogicMode.EnergyShield => text.T("logic.energy_shield", "Energy Shield (CI/LL)"),
            LogicMode.HybridLifeEs => text.T("logic.hybrid_life_es", "Hybrid (Life & ES)"),
            LogicMode.ManaOnly => text.T("logic.mana_only", "Mana"),
            LogicMode.ManaAndEs => text.T("logic.mana_and_es", "Mana + ES"),
            LogicMode.LifeEsMana => text.T("logic.life_es_mana", "Life + ES + Mana"),
            _ => mode.ToString(),
        };

        public static readonly LogicMode[] All =
        {
            LogicMode.ManaAndLife,
            LogicMode.LifeOnly,
            LogicMode.EnergyShield,
            LogicMode.HybridLifeEs,
            LogicMode.ManaOnly,
            LogicMode.ManaAndEs,
            LogicMode.LifeEsMana,
        };
    }
}
