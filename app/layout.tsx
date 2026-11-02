import type {Metadata} from 'next';
import '../src/styles.css';

export const metadata:Metadata={title:'moment · Private photo workbench',description:'Your photos, albums and reusable styles.'};
export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
