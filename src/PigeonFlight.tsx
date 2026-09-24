export function PigeonFlight() {
  return <>
    <svg className="pigeon-hills" viewBox="0 0 600 48" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <path className="hills-far" d="M0 40H20V36H36V32H52V28H64V24H76V20H88V24H100V28H116V32H136V36H160V32H176V28H188V24H200V20H212V16H224V12H236V16H248V20H260V24H276V28H292V32H316V36H340V32H356V28H368V24H380V20H392V16H404V20H416V24H428V28H444V32H468V36H488V32H504V28H520V24H532V28H548V32H568V36H588V40H600V48H0Z" />
      <path className="hills-near" d="M0 44H24V42H48V40H68V38H88V36H112V38H136V40H160V42H192V44H224V42H248V40H268V38H288V34H308V32H328V34H348V38H372V40H400V42H428V44H456V42H476V40H496V38H520V36H540V38H564V40H584V42H600V48H0Z" />
    </svg>
    <div className="pigeon-scene" aria-hidden="true">
    <div className="pigeon-track">
      <div className="pigeon-travel">
        <div className="pigeon-bob">
          <svg className="pixel-pigeon" width="28" height="24" viewBox="0 0 28 24" fill="currentColor" shapeRendering="crispEdges" focusable="false">
            {/* A square-headed pigeon with a short beak and a fanned tail. */}
            <path d="M2 12H6V14H10V12H18V8H24V10H26V12H24V16H20V18H12V16H6V14H2Z" />
            <path className="pigeon-wing-up" d="M10 14V8H8V4H10V2H12V4H14V6H16V10H18V14Z" />
            <path className="pigeon-wing-down" d="M10 12H18V16H16V20H14V22H10V20H12V16H10Z" />
          </svg>
        </div>
      </div>
    </div>
    </div>
  </>
}
