// Lucide icons available for place types (name -> component)
import HouseIcon from 'lucide-svelte/icons/house';
import DoorClosedIcon from 'lucide-svelte/icons/door-closed';
import LibraryIcon from 'lucide-svelte/icons/library';
import ArchiveIcon from 'lucide-svelte/icons/archive';
import BoxIcon from 'lucide-svelte/icons/box';
import BoxesIcon from 'lucide-svelte/icons/boxes';
import PackageIcon from 'lucide-svelte/icons/package';
import PackageOpenIcon from 'lucide-svelte/icons/package-open';
import WarehouseIcon from 'lucide-svelte/icons/warehouse';
import ContainerIcon from 'lucide-svelte/icons/container';
import BriefcaseIcon from 'lucide-svelte/icons/briefcase';
import ShirtIcon from 'lucide-svelte/icons/shirt';
import WrenchIcon from 'lucide-svelte/icons/wrench';
import HammerIcon from 'lucide-svelte/icons/hammer';
import FolderIcon from 'lucide-svelte/icons/folder';
import LayersIcon from 'lucide-svelte/icons/layers';
import SofaIcon from 'lucide-svelte/icons/sofa';
import BedIcon from 'lucide-svelte/icons/bed';
import CarIcon from 'lucide-svelte/icons/car';
import LampIcon from 'lucide-svelte/icons/lamp';
import BookIcon from 'lucide-svelte/icons/book';
import UtensilsIcon from 'lucide-svelte/icons/utensils';
import TentIcon from 'lucide-svelte/icons/tent';
import BikeIcon from 'lucide-svelte/icons/bike';
import MapPinIcon from 'lucide-svelte/icons/map-pin';
import BuildingIcon from 'lucide-svelte/icons/building';
import StoreIcon from 'lucide-svelte/icons/store';
import FileBoxIcon from 'lucide-svelte/icons/file-box';
import ShelvingUnitIcon from 'lucide-svelte/icons/shelving-unit';
import BackpackIcon from 'lucide-svelte/icons/backpack';
import LuggageIcon from 'lucide-svelte/icons/luggage';
import InboxIcon from 'lucide-svelte/icons/inbox';
import ToolboxIcon from 'lucide-svelte/icons/toolbox';

export const ICONS: Record<string, any> = {
  'house': HouseIcon,
  'door-closed': DoorClosedIcon,
  'library': LibraryIcon,
  'archive': ArchiveIcon,
  'box': BoxIcon,
  'boxes': BoxesIcon,
  'package': PackageIcon,
  'package-open': PackageOpenIcon,
  'warehouse': WarehouseIcon,
  'container': ContainerIcon,
  'briefcase': BriefcaseIcon,
  'shirt': ShirtIcon,
  'wrench': WrenchIcon,
  'hammer': HammerIcon,
  'folder': FolderIcon,
  'layers': LayersIcon,
  'sofa': SofaIcon,
  'bed': BedIcon,
  'car': CarIcon,
  'lamp': LampIcon,
  'book': BookIcon,
  'utensils': UtensilsIcon,
  'tent': TentIcon,
  'bike': BikeIcon,
  'map-pin': MapPinIcon,
  'building': BuildingIcon,
  'store': StoreIcon,
  'file-box': FileBoxIcon,
  'shelving-unit': ShelvingUnitIcon,
  'backpack': BackpackIcon,
  'luggage': LuggageIcon,
  'inbox': InboxIcon,
  'toolbox': ToolboxIcon,
};

export const ICON_NAMES = Object.keys(ICONS);
export const iconFor = (name: string) => ICONS[name] ?? BoxIcon;
