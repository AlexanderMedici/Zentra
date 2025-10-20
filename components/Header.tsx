import Link from "next/link";
import Image from "next/image";
import NavItems from "./NavItems";
import UserDropdown from './UserDropdown';

const Header = () => {
    return (
        <header className="sticky top-0 header">
            <div className="continer header-wrapper">
                 <Link href="/">
                <Image src="/assets/icons/finsage13.png" alt="Finsage logo" width={140} height={42} className="h-8 w-auto cursor-pointer"/>
                </Link>
                <nav className="hidden sm:block">
                    <NavItems />
                </nav>
                <UserDropdown />
            </div>
        </header>
    )
}
export default Header
