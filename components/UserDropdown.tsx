'use client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; 
import { useRouter } from "next/navigation"; 
import { Button } from "@/components/ui/button"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"


const UserDropdown = () => {
    const router = useRouter();   
    const handleSignOut = async () => { 
        router.push("/sign-in")

    }
    const user = {name:'test', email:'contact@somemail.com'}; 
    return (
 <DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" className="flex items-center gap-3 text-gray-4 hover:text-yellow-500">
        <Avatar className="h-8 w-8"> 
            {/* <AvatarImage src="https://github.com/shadcn.png" /> */}
                <AvatarFallback className="bg-yellow-500 text-yellow-900 text-sm font-bold">
                    {user.name[0]}
                </AvatarFallback>
        </Avatar>
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>My Account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Billing</DropdownMenuItem>
    <DropdownMenuItem>Team</DropdownMenuItem>
    <DropdownMenuItem>Subscription</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
  )
}


export default UserDropdown