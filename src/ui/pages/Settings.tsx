import { plugin } from "@vendetta";
import { useProxy } from "@vendetta/storage";
import { React } from "@vendetta/metro/common";
import { NavigationNative } from "@vendetta/metro/common";
import {
    Stack,
    TableRowGroup,
    TableRow,
    TableSwitchRow,
    ScrollView,
} from "./pages/components/TableComponents";

// Import pages
import ListenBrainzSettingsPage from "./pages/ListenBrainzSettingsPage";
import DisplaySettingsPage from "./pages/DisplaySettingsPage";
import RPCCustomizationSettingsPage from "./pages/RPCCustomizationSettingsPage";
import IgnoreListSettingsPage from "./pages/IgnoreListSettingsPage";
import LoggingSettingsPage from "./pages/LoggingSettingsPage";

import { ServiceType } from "../../../../defs";

// Storage defaults
plugin.storage.username ??= "";
plugin.storage.apiKey ??= "";
plugin.storage.appName ??= "Music";
plugin.storage.timeInterval ??= 5;
plugin.storage.showTimestamp ??= true;
plugin.storage.listeningTo ??= true;
plugin.storage.verboseLogging ??= false;
plugin.storage.service ??= "listenbrainz";
plugin.storage.listenbrainzUsername ??= "";
plugin.storage.listenbrainzToken ??= "";
plugin.storage.addToSidebar ??= true;
plugin.storage.showLargeText ??= true;
plugin.storage.ignoreList ??= [];
plugin.storage.showAlbumInTooltip ??= true;
plugin.storage.showDurationInTooltip ??= true;

export const getStorage = (k: string, fallback?: any) =>
    plugin.storage[k] ?? fallback;
export const setStorage = (k: string, v: any) => (plugin.storage[k] = v);

// Integrated ServiceFactory
class ServiceFactory {
    static getServiceDisplayName(service: ServiceType): string {
        switch (service) {
            case "listenbrainz":
                return "ListenBrainz";
            default:
                return "Unknown";
        }
    }

    static async testService(service: ServiceType): Promise<boolean> {
        try {
            switch (service) {
                case "listenbrainz":
                    return await this.testListenBrainzConnection();
                default:
                    return false;
            }
        } catch (error) {
            console.error(`Error testing ${service}:`, error);
            return false;
        }
    }

    private static async testListenBrainzConnection(): Promise<boolean> {
        const username = getStorage("listenbrainzUsername");
        const token = getStorage("listenbrainzToken");
        if (!username) return false;
        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (token) headers["Authorization"] = `Token ${token}`;
            const response = await fetch(
                `https://api.listenbrainz.org/1/user/${username}/listen-count`,
                { headers },
            );
            return response.status === 200;
        } catch (error) {
            console.error("ListenBrainz connection test failed:", error);
            return false;
        }
    }
}

export const serviceFactory = ServiceFactory;

export default function Settings() {
    useProxy(plugin.storage);
    const navigation = NavigationNative.useNavigation();
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

    const currentService = getStorage("service") as ServiceType;

    const getCredentialStatus = (service: ServiceType) => {
        switch (service) {
            case "listenbrainz":
                return getStorage("listenbrainzUsername")
                    ? "Configured"
                    : "Missing username";
            default:
                return "Unknown";
        }
    };

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10 }}>
            <Stack spacing={8}>
                {/* Service Configuration */}
                <TableRowGroup title="Service Configuration">
                    <TableRow
                        label="Current Service"
                        subLabel={serviceFactory.getServiceDisplayName(currentService)}
                    />
                    <TableRow
                        label="ListenBrainz Settings"
                        subLabel="Configure ListenBrainz credentials and options"
                        trailing={<TableRow.Arrow />}
                        onPress={() =>
                            navigation.push("VendettaCustomPage", {
                                title: "ListenBrainz Settings",
                                render: ListenBrainzSettingsPage,
                            })
                        }
                    />
                </TableRowGroup>

                {/* Plugin Configuration */}
                <TableRowGroup title="Plugin Configuration">
                    <TableRow
                        label="Display Settings"
                        subLabel="Customize app name and update interval"
                        trailing={<TableRow.Arrow />}
                        onPress={() =>
                            navigation.push("VendettaCustomPage", {
                                title: "Display Settings",
                                render: DisplaySettingsPage,
                            })
                        }
                    />
                    <TableRow
                        label="RPC Customization"
                        subLabel="Customize Discord rich presence display options"
                        trailing={<TableRow.Arrow />}
                        onPress={() =>
                            navigation.push("VendettaCustomPage", {
                                title: "RPC Customization",
                                render: RPCCustomizationSettingsPage,
                            })
                        }
                    />
                    <TableRow
                        label="Ignore List"
                        subLabel="Configure apps that should hide your status"
                        trailing={<TableRow.Arrow />}
                        onPress={() =>
                            navigation.push("VendettaCustomPage", {
                                title: "Ignore List Settings",
                                render: IgnoreListSettingsPage,
                            })
                        }
                    />
                    <TableRow
                        label="Logging Settings"
                        subLabel="Configure logging and debugging options"
                        trailing={<TableRow.Arrow />}
                        onPress={() =>
                            navigation.push("VendettaCustomPage", {
                                title: "Logging Settings",
                                render: LoggingSettingsPage,
                            })
                        }
                    />
                    <TableSwitchRow
                        label="Add to Sidebar"
                        subLabel="Show plugin in Discord settings"
                        value={getStorage("addToSidebar", false)}
                        onValueChange={(value: boolean) => {
                            setStorage("addToSidebar", value);
                            forceUpdate();
                        }}
                    />
                </TableRowGroup>

                {/* About */}
                <TableRowGroup title="About">
                    <TableRow
                        label="Multi Scrobbler"
                        subLabel="Show off your music status from ListenBrainz on Discord"
                    />
                    <TableRow label="Author" subLabel="kmmiio99o" />
                    <TableRow label="Version" subLabel="1.3.2" />
                </TableRowGroup>
            </Stack>
        </ScrollView>
    );
}
